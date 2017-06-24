Simple twitter bot that composes a short little ditty out of a tweet. Listens for tweets with a given mention word (a twitter handle, search term etc). Because Twitter only supports uploading audio in video form, this uploads the song as a video.

### Setup
- `npm install`
- `brew install timidity`
- create a Twitter app and get your keys
  - N.B. this will post under your app's Twitter account, switch to a different account if you don't want this on your main
- create .env file and fill out `TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET` and the term to listen for as `MENTION`
- run with `node index.js`


### TODOs
- switch to https://github.com/walmik/scribbletune for composing, figure out other algos
- update video background (pull image based off the tweet content?)
- refactor

### Libraries
- `rita` for language processing
- `jsmidgen` for converting the tweet to music (TODO: switch to `scribbletune`)
- `timidity` for converting MIDI to WAV
- `Twit` for twitter api
