### TUNESCRIBBLER

A twitter bot that composes a short little ditty out of a tweet. Listens for tweets with a given mention word (a twitter handle, search term etc), and replies to that tweet with a song generated from its text.

The song generation's very simple for now - we parse the tweet text into parts of speech and map each of those to notes in a 6-octave range with a bit of randomization, then generate a midi from the notes (note that because Twitter only supports uploading audio in video form, the song is uploaded as a video).

Demo: https://twitter.com/tunescribbler/status/938635066074333184

### Setup

- `npm install`
- `brew install timidity
- create a Twitter app and get your keys:
  - N.B. this will post under your app's Twitter account, so create the app under a side account if you don't want these tweets to post from your main
- create a `.env` file and fill out `TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET` and the term to listen for as `MENTION` (can be a twitter handle like `@username` or a search term like `cute`)
- `node index.js` to start listening!

### Toolkit
- `rita` for language processing
- `jsmidgen` for converting the tweet to music
- `timidity` for converting MIDI to WAV
- `Twit` for twitter api

### TODOs
- switch to https://github.com/walmik/scribbletune for composing
- figure out other algos for song generation
- update video background (pull image based off the tweet content)