require('dotenv').config()

var Twit = require('twit');
var rita = require('rita');
var midi = require('jsmidgen');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var ffmpegPath = require('@ffmpeg-installer/ffmpeg');
var ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath.path);

// @tunescribbler
var bot = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms: 60 * 1000
});

var bot_username = process.env.MENTION; // any tweet with this in it

var IMG_PATH = path.join(process.cwd(), 'black.jpg'); // background image for video file
var MIDI_FILENAME = 'output.mid';
var WAV_FILENAME = 'output.wav';
var MP4_FILENAME = 'output.mp4';
var MIDI_PATH = path.join(process.cwd(), 'output', MIDI_FILENAME);
var WAV_PATH = path.join(process.cwd(), 'output', WAV_FILENAME);
var VID_PATH = path.join(process.cwd(), 'output', MP4_FILENAME);

// filter the twitter public stream by the word 'mango'.
var stream = bot.stream('statuses/filter', {
    track: bot_username
});

stream.on('connecting', function(response){
    console.log('connecting...');
});

stream.on('connected', function(response){
    console.log('connected!');
});

stream.on('error', function(err){
    console.log(err);
});

stream.on('tweet', function(tweet){
    console.log("on tweet!", tweet.text);

    if (tweet.text.length > 0){
        createMedia(tweet, IMG_PATH, MIDI_PATH, WAV_PATH, VID_PATH, function(err){
            if (err){
                console.log(err);
            } else {
                console.log('Media created! deleting: ' + WAV_PATH);
                // delete the wave file (err when the program tries to create a wave with file already there)
                deleteWav(WAV_PATH, function(err){
                    if (err){
                        console.log(err);
                    } else {
                        uploadMedia(tweet, VID_PATH);
                    }
                });
            }
        });
    }
});

/**
* Map parts of speech to a note. 
**/
function compose(taggedTweet, track){
    var notes = taggedTweet.map(function(tag){
        if (tag.includes('nn') || tag.includes('i')){
            return 'e4';
        }
        if (tag.includes('vb')){
            return 'g4';
        }

        return 'c4';
    });

    notes.forEach(function(note){
        // channel, notestring, duration (128 = quarter note)
        track.addNote(0, note, 128);
    });

    return track;
}

// ========== MEDIA PROCESSING =========

/**
*  Create MIDI file => convert MIDI to WAVE => create video
**/
function createMedia(tweet, IMG_PATH, MIDI_PATH, WAV_PATH, VID_PATH, cb){
    createMidi(tweet, MIDI_PATH, function(err, result){
        if (err) {
            console.log(err);
        } else {
            convertMidiToWav(MIDI_PATH, WAV_PATH, function(err){
                if (err){
                    console.log(err);
                } else {
                    console.log('Midi converted!', MIDI_PATH, WAV_PATH);
                    createVideo(IMG_PATH, WAV_PATH, VID_PATH, cb);
                }
            })
        }
    });
}

function createMidi(tweet, MIDI_PATH, cb){
    var file = new midi.File();
    var track = new midi.Track();
    file.addTrack(track);

    var cleanedText = rita.RiTa
        .tokenize(cleanText(tweet.text))
        .filter(isNotPunctuation)
        .join(' ');

    // map POS to notes, add to track
    var taggedTweet = getPartsOfSpeech(cleanedText);
    compose(taggedTweet, track);

    fs.writeFile(MIDI_PATH, file.toBytes(), { encoding: 'binary' }, cb);
}

function convertMidiToWav(MIDI_PATH, WAV_PATH, cb){
    var command = "timidity --output-24bit -A120 ./output/" + MIDI_FILENAME + " -Ow -o ./output/" + WAV_FILENAME;
    console.log("running conversion: ", command);
    child_process.exec(command, {}, function(err, stdout, stderr) {
        console.log('convert midi to wave, err:', err)
        if (err){
            cb(err);
        } else {
            cb(null);
        }
    });    
}

function createVideo(IMG_PATH, WAV_PATH, VID_PATH, cb){
    ffmpeg()
        .on('end', () => cb(null))
        .on('error', (err, stdout, stderr) => cb(err))
        .input(IMG_PATH)
        .inputFPS(1/6)
        .input(WAV_PATH)
        .output(VID_PATH)
        .outputFPS(30)
        .run();
}

function deleteWav(WAV_PATH, cb){
    var command = "rm ./output/" + WAV_FILENAME;
    child_process.exec(command, {}, (err, stdout, stderr) => {
        if (err){
            cb(err);
        } else {
            cb(null);
        }
    });
}

// ======= OUTPUT =========
function uploadMedia(tweet, VID_PATH){
    bot.postMediaChunked({ file_path: VID_PATH }, function(err, data, response){
        if (err){
            console.log(err);
        } else {
            console.log("posted video: ", data);
            var stat = tweet.text.split(bot_username)
                .join(' ')
                .trim();

            var params = {
                status: '@' + tweet.user.screen_name + ' ' + stat,
                // status: `scribbling. . . ${stat}`,
                in_reply_to_status_id: tweet.id_str, // replying to my app
                media_ids: data.media_id_string
            }

            postStatus(params);
        }
    });
}

function postStatus(params){
    bot.post('statuses/update', params, function(err, data, response){
        if (err){
            console.log(err);
        } else {
            console.log('Bot has posted!');
        }
    });
}

// ==== TWEET PROCESSING ====

function hasNoStopwords(token){
    var stopwords = ['@', 'RT', 'http'];
    return stopwords.every(function(sw){
        return !token.includes(sw);
    });
}

function isNotPunctuation(token){
    return !rita.RiTa.isPunctuation(token);
}

function cleanText(text){
    return text.split(' ')
        .filter(hasNoStopwords)
        .join(' ')
        .trim();
}

function getPartsOfSpeech(text){
    return rita.RiTa.getPosTags(text);
}











