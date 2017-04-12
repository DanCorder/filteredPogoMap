'use strict'

function filterTweets() {
    var logging = true;
    var live = false;

    var Twitter = require('twitter');
    var AWS = require("aws-sdk");

    const dbTableName = 'latestTweetProcessed';
    const dbPrimaryKey = 'twitterStream';
    const londonPogoMapKeyValue = 'LondonPogoMap';

    AWS.config.update({
        region: "us-west-2",
        endpoint: "http://localhost:8000"
    });

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

    function log(message) {
        if (logging) {
            console.log(message);
        }
    }

    var dynamodb = new AWS.DynamoDB();
    dynamodb.describeTable({ TableName: dbTableName}, ensureTableExists);

    function ensureTableExists(error, data) {
        if (error) {
            log('Error getting table details: ' + JSON.stringify(error, null, 2));

            if (error.code === 'ResourceNotFoundException') {
                var params = {
                    TableName : dbTableName,
                    KeySchema: [
                        { AttributeName: dbPrimaryKey, KeyType: "HASH"}
                    ],
                    AttributeDefinitions: [
                        { AttributeName: dbPrimaryKey, AttributeType: "S" }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 1,
                        WriteCapacityUnits: 1
                    }
                };
                dynamodb.createTable(params, getLatestTweetId);
            } else {
                log('Unrecognised error getting table details. Aborting.');
                context.done('Unrecognised error getting table details.');
            }
        } else {
            getLatestTweetId();
        }
    }

    function getLatestTweetId(error, data) {
        if (error) {
            const errorMessage = 'Error creating table: ' + JSON.stringify(error, null, 2);
            log(errorMessage);
            context.done(errorMessage);
        } else {
            var params = {
                TableName: dbTableName,
                KeyConditionExpression: "#feed = :feed",
                ExpressionAttributeNames:{
                    "#feed": dbPrimaryKey
                },
                ExpressionAttributeValues: {
                    ":feed": londonPogoMapKeyValue
                }
            };
            var docClient = new AWS.DynamoDB.DocumentClient();
            docClient.query(params, extractTweetId);
            //client.get('statuses/user_timeline', timelineParams, timelineCallback);
        }
    }

    function extractTweetId(error, data) {
        if (error) {
            const errorMessage = 'Error reading latest tweet: ' + error;
            log(errorMessage);
            context.done(errorMessage);
        } else {
            var latestTweetProcessed = '849338036789932038';
            if (data.Items.length > 0) {
                latestTweetProcessed = data.Items[0].latestTweetProcessed;
            }

            var timelineParams = {
                screen_name: 'LondonPogoMap',
                count: 100,
                trim_user: true,
                since_id: latestTweetProcessed
            };

            client.get('statuses/user_timeline', timelineParams, timelineCallback);
        }
    }

    function timelineCallback(error, tweets, response) {
        if (error) {
            const errorMessage = 'Error getting tweets: ' + error;
            log(errorMessage);
            context.done(errorMessage);
        }

        log('Got tweets');

        var filteredTweets = filter(tweets);

        for (var i = 0; i < filteredTweets.length; i++) {
            retweet(filteredTweets[i]);
            //qq:DCC handle multiple callbacks
            //qq:DCC write highest tweet back to DB
        }
    };

    function filter(tweets) {
        log('Filtering ' + tweets.length + ' tweets');
        //qq:DCC filter

        var ret = [];
        ret.push(tweets[0]);
        log(ret);
        return ret;
    };

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
}
