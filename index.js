function filterTweets() {

    var Twitter = require('twitter');

    var client = new Twitter({
        consumer_key: 'PIn3Ef1nElOQ5bRODTG49dU3t',
        consumer_secret: 'sCTvJtXDXP3RTNvPi9PLNnj6d0WdxPjlH8ZjXskdiRsnwfK7e3',
        access_token_key: '848280385851187201-de5PvKLGEq55XQQW54XrtL52tpeuWXW',
        access_token_secret: 'RHnlSgpWhoSL2ghJvpQMbkDxGBhAIhYDPEkkAK0BEb2VB'
    });

    var wantedPokemon = [
        'Lapras',
        'Snorlax',
        'Gyrados',
        //qq:DCC Add more
    ];

    var logging = true;
    var live = false;

    function log(message) {
        if (logging) {
            console.log(message);
        }
    }

    var highestTweetId = 848803011782725600;
    function getHighestTweetId() {
        return highestTweetId;
    }

    function setHighestTweetId(id) {
        highestTweetId = id;
    }

    function retweet(tweet) {

        var retweetParams = {
            id: tweet.id_str
        };
        log('retweeting tweet id ' + tweet.id_str);

        if (live) {
            log('Retweeting: ' + tweet);
            client.post('statuses/retweet', retweetParams, retweetCallback);
        }
    };

    function retweetCallback(error, tweet, response) {
        log(error);
        if(error) {
            throw error.message;
        }

        log('Retweet success!');
    };

    function filter(tweets) {
        log('Filtering ' + tweets.length + ' tweets');
        //qq:DCC filter

        var ret = [];
        ret.push(tweets[0]);
        log(ret);
        return ret;
    };

    function timelineCallback(error, tweets, response) {
        if(error) {
            throw error;
        }

        log('Got tweets');

        var filteredTweets = filter(tweets);

        for (var i = 0; i < filteredTweets.length; i++) {
            retweet(filteredTweets[i]);
        }
    };

    var timelineParams = {
        screen_name: 'LondonPogoMap',
        count: 100,
        trim_user: true,
        since_id: getHighestTweetId()
    };

    client.get('statuses/user_timeline', timelineParams, timelineCallback);
}

filterTweets();