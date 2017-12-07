require('dotenv').config()

const Twit = require('twit');
const rita = require('rita');
const  midi = require('jsmidgen');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath.path);

// @tunescribbler
const bot = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms: 60 * 1000
});

// The mention word to listen to - will detect any tweet with this text in it 
const bot_username = process.env.MENTION;

const IMG_PATH = path.join(process.cwd(), 'black.jpg'); // background image for video file
const MIDI_FILENAME = 'output.mid';
const WAV_FILENAME = 'output.wav';
const MP4_FILENAME = 'output.mp4';
const MIDI_PATH = path.join(process.cwd(), 'output', MIDI_FILENAME);
const WAV_PATH = path.join(process.cwd(), 'output', WAV_FILENAME);
const VID_PATH = path.join(process.cwd(), 'output', MP4_FILENAME);

const QUARTER_NOTE_UNIT = 128; // standard ticks for a quarter note duration

// flag to avoid converting and uploading multiple at once
let READY = false;

// filter the twitter public stream by the MENTION word 
const stream = bot.stream('statuses/filter', {
    track: bot_username
});

stream.on('connecting', function(response){
    console.log('connecting...');
});

stream.on('connected', function(response){
    console.log('connected!');
    READY = true;
});

stream.on('error', function(err){
    console.log(err);
});

stream.on('tweet', function(tweet){
    console.log("===== on tweet! =====", tweet.text);
    if (!READY) {
        return;
    }
    READY = false;

    if (tweet.text.length > 0){
        createMedia(tweet, IMG_PATH, MIDI_PATH, WAV_PATH, VID_PATH, function(err){
            if (err){
                console.log(err);
            } else {
                console.log('Media created! deleting: ' + WAV_PATH);
                // delete the wave file (err when the program tries to create a wave with file already there)
                deleteWav(WAV_PATH, function(err){
                    if (err){
                        console.log("deleteWave ERROR", err);
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
* @see https://rednoise.org/rita/reference/PennTags.html
**/
function compose(taggedTweet, track){
    let notes = taggedTweet.map((tag) => {
        // let's take 6 octaves (2-6), where 4 is middle c
        let octaveNum = Math.round(Math.random() * (6-2)) + 2;
        let note = 'c'; 

        if (tag.includes('jj')) { // adjective
            note = 'd'
        }
        if (tag.includes('nn') || tag.includes('prp')) { // noun
            note = 'e';
        }
        if (tag.includes('i')) { // preposition
            note = 'f';
        }
        if (tag.includes('vb')){ // verb
            note = 'g';
        }
        if (tag.includes('rb')) { // adverb
            note = 'a';
        }
        if (tag.includes('rp')) { // particles
            note = 'b';
        }
        if (tag.includes('w')) { // wh
            note = 'c';
        }

        return note + octaveNum;
    });

    notes.forEach((note) => {
        // channel, pitch, duration (128 = quarter note)
        let duration = getDurationInTicks(Math.random() * 4, QUARTER_NOTE_UNIT);
        track.addNote(0, note, duration);
    });

    return track;
}

// Given a note length between 0-4 where 1 = quarter note, and the standard quarter note's duration in ticks, return the duration in ticks
function getDurationInTicks(time, quarterUnit) {
    if (time < 1) {
        return quarterUnit;
    } else if (time > 1 && time < 2) {
        return quarterUnit*2;
    } else if (time > 2 && time < 3) {
        return quarterUnit*3;
    } else {
        return quarterUnit*4;
    }
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
    let file = new midi.File();
    let track = new midi.Track();
    file.addTrack(track);

    let cleanedText = rita.RiTa
        .tokenize(cleanText(tweet.text))
        .filter(isNotPunctuation)
        .join(' ');

    // map POS to notes, add to track
    let taggedTweet = getPartsOfSpeech(cleanedText);
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
    let command = "rm ./output/" + WAV_FILENAME;
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
            console.log("uploadMedia ERROR", err);
        } else {
            console.log("posted video: ", data);
            let stat = tweet.text.split(bot_username).join(' ').trim();

                let params = {
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
            console.log("postStatus ERROR", err);
        } else {
            console.log('===== Bot has posted! ===== ');
        }

        READY = true;
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











