'use strict'

exports.handler = function filterTweets(event, context, callback) {
    var logging = true;

    var Twitter = require('twitter');
    var AWS = require("aws-sdk");
    var haversine = require('haversine');

    var highgateStudiosCoordinates = {
        latitude: 51.553864,
        longitude: -0.144119
    };

    const dbTableName = 'latestTweetProcessed';
    const dbPrimaryKey = 'twitterStream';
    const dbTweetIdColumnName = 'latestTweetProcessed';
    const londonPogoMapKeyValue = 'LondonPogoMap';

    var createNewDynamoRecord = true;

    AWS.config.update({
        region: "us-west-2",
        endpoint: process.env.dynamodb_url
    });

    var twitterClient = new Twitter({
        consumer_key: process.env.twitter_consumer_key,
        consumer_secret: process.env.twitter_consumer_secret,
        access_token_key: process.env.twitter_access_token_key,
        access_token_secret: process.env.twitter_access_token_secret
    });

    var docClient = new AWS.DynamoDB.DocumentClient();

// Tweeted Pokemon:
//Gen 1: Venusaur, Charizard, Blastoise, Arcanine, Alakazam, Exeggutor, Chansey, Gyarados, Lapras, Vaporeon, Jolteon, Flareon, Aerodactyl, Snorlax, Articuno, Zapdos, Moltres, Dragonite, Mewtwo, Mew, Hitmonlee, Hitmonchan, Muk, Machamp, Lickitung, Golem, Rhydon, Tangela.
//Gen 2: Meganium, Typhlosion, Feraligatr, Togetic, Ampharos, Espeon, Umbreon, Unown, Forretress, Steelix, Scizor, Heracross, Kingdra, Donphan, Porygon2, Hitmontop, Miltank, Blissey, Pupitar, Tyranitar.

    var wantedPokemon = [
        { name: 'Lapras', minIv: 80, radiusMeters: 1000 },
        { name: 'Snorlax', minIv: 80, radiusMeters: 1000 },
        { name: 'Gyrados', minIv: 80, radiusMeters: 1000 },
        { name: 'Togetic', minIv: 80, radiusMeters: 2500 },
        { name: 'Chansey', minIv: 80, radiusMeters: 2500 },
        { name: 'Vaporeon', minIv: 80, radiusMeters: 1000 },
        { name: 'Articuno', minIv: 0, radiusMeters: 100000 },
        { name: 'Zapdos', minIv: 0, radiusMeters: 100000 },
        { name: 'Moltres', minIv: 0, radiusMeters: 100000 },
        { name: 'Dragonite', minIv: 80, radiusMeters: 2500 },
        { name: 'Mewtwo', minIv: 0, radiusMeters: 100000 },
        { name: 'Mew', minIv: 0, radiusMeters: 100000 },
        { name: 'Muk', minIv: 80, radiusMeters: 1000 },
        { name: 'Golem', minIv: 80, radiusMeters: 1000 },
        { name: 'Meganium', minIv: 80, radiusMeters: 1000 },
        { name: 'Ampharos', minIv: 80, radiusMeters: 2500 },
        { name: 'Espeon', minIv: 80, radiusMeters: 1000 },
        { name: 'Unown', minIv: 0, radiusMeters: 2500 },
        { name: 'Heracross', minIv: 0, radiusMeters: 100000 },
        { name: 'Porygon2', minIv: 80, radiusMeters: 2500 },
        { name: 'Blissey', minIv: 80, radiusMeters: 2500 },
        { name: 'Pupitar', minIv: 0, radiusMeters: 2500 },
        { name: 'Tyranitar', minIv: 0, radiusMeters: 2500 },
        { name: 'Kangaskhan', minIv: 0, radiusMeters: 10000 },
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
            }
        } else {
            getLatestTweetId();
        }
    }

    function getLatestTweetId(error, data) {
        if (error) {
            const errorMessage = 'Error creating table: ' + JSON.stringify(error, null, 2);
            log(errorMessage);
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
            docClient.query(params, extractTweetId);
        }
    }

    function extractTweetId(error, data) {
        if (error) {
            const errorMessage = 'Error reading latest tweet: ' + error;
            log(errorMessage);
        } else {
            var latestTweetProcessed = '849338036789932038';
            if (data.Items.length > 0) {
                createNewDynamoRecord = false;
                latestTweetProcessed = data.Items[0][dbTweetIdColumnName];
            }

            var timelineParams = {
                screen_name: 'LondonPogoMap',
                count: 100,
                trim_user: true,
                since_id: latestTweetProcessed
            };

            twitterClient.get('statuses/user_timeline', timelineParams, timelineCallback);
        }
    }

    var filteredTweetCount = 0;
    var latestTweetId = undefined;
    function timelineCallback(error, tweets, response) {
        if (error) {
            const errorMessage = 'Error getting tweets: ' + error;
            log(errorMessage);
        } else {
            log('Got tweets');

            latestTweetId = findLatestTweetId(tweets);
            var filteredTweets = filter(tweets);

            if (filteredTweets.length === 0) {
                log('Nothing to retweet');
                writeLatestTweetToDb();
            }
            else {
                filteredTweetCount = filteredTweets.length;

                for (var i = 0; i < filteredTweets.length; i++) {
                    retweet(filteredTweets[i]);
                }
            }
        }
    };

    function findLatestTweetId(tweets) {
        if (tweets.length === 0) {
            return undefined;
        }

        // Assume tweets are always in descending order
        return tweets[0].id_str;
    };

    function retweet(tweet) {
        var retweetParams = {
            id: tweet.id_str
        };
        log('retweeting tweet id ' + tweet.id_str);

        if (process.env.retweet_enabled === 'true') {
            twitterClient.post('statuses/retweet', retweetParams, retweetCallback);
        } else {
            retweetCallback();
        }
    };

    function retweetCallback(error, tweet, response) {
        // Node is single threaded so this is safe.
        filteredTweetCount--;

        if(error) {
            log(error);
            //qq:DCC anything else we can do? Throwing will stop us updating DynamoDB.
        }
        else {
            log('Retweet success!');
        }

        if (filteredTweetCount === 0) {
            // This is the last callback
            writeLatestTweetToDb();
        }
    };

    function writeLatestTweetToDb() {
        if (latestTweetId !== undefined) {
            if (createNewDynamoRecord) {
                var params = {
                    TableName: dbTableName,
                    Item: {}
                };
                params.Item[dbPrimaryKey] = londonPogoMapKeyValue;
                params.Item[dbTweetIdColumnName] = latestTweetId;
                docClient.put(params, endLambda);
            }
            else {
                var params = {
                    TableName: dbTableName,
                    Key:{},
                    UpdateExpression: "set " + dbTweetIdColumnName + " = :t",
                    ExpressionAttributeValues: {
                        ":t": latestTweetId
                    },
                    ReturnValues:"UPDATED_NEW"
                };
                params.Key[dbPrimaryKey] = londonPogoMapKeyValue;
                docClient.update(params, endLambda);
            }
        }
        else {
            endLambda();
        }
    }

    function endLambda(error, data) {
        if (error) {
            const errorMessage = 'Error writing tweet ID to DB: ' + error;
            log(errorMessage);
        }
    }

    function filter(tweets) {
        log('Filtering ' + tweets.length + ' tweets');
        return tweets.filter(t => matchesFilter(t));
    };

    function matchesFilter(tweet) {
        //[London] Lapras (M) (IV: 57%) until 08:38:21PM at 113 Blackshaw Rd https://t.co/eCPFnl9k7n https://t.co/vYCLEbvt9L
        //[London] Lapras (M)  until 08:38:21PM at 113 Blackshaw Rd https://t.co/eCPFnl9k7n https://t.co/vYCLEbvt9L
        //[London] Rhydon (F) (IV: 42% - CP: 2103) until 09:46:53PM at 165 Sydenham Hill https://t.co/ZNXvuakyjh https://t.co/KlpQoo8nl6
        var textParser = /\[.*\] (.*) \(.*\) (\(IV: (\d+)%.*\))? until.*/;
        var textMatchResult = textParser.exec(tweet.text);

        if (textMatchResult === null) {
            log('Didn\'t understand tweet: ' + tweet.text);
            return false;
        }

        var pokemonName = textMatchResult[1];
        var pokemonIv = 100;
        if (textMatchResult.length >= 4) {
            pokemonIv = parseInt(textMatchResult[3]);
        }

        var wantedDetails = wantedPokemon.filter(wp => wp.name === pokemonName);
        if (wantedDetails.length === 0) {
            return false;
        }
        if (pokemonIv < wantedDetails[0].minIv) {
            return false;
        }

        // Example URL https://maps.google.com/maps?q=51.5775697,-0.14814645
        var googleMapsUrl = tweet.entities.urls[1].expanded_url;
        var linkParser = /https:\/\/maps\.google\.com\/maps\?q=(-?\d*\.\d+),(-?\d*\.\d+)/;
        var linkMatchResult = linkParser.exec(googleMapsUrl);

        if (linkMatchResult === null) {
            return false;
        }

        var pokemonCoordinates = {
            latitude: parseFloat(linkMatchResult[1]),
            longitude: parseFloat(linkMatchResult[2])
        };

        return haversine(
            highgateStudiosCoordinates,
            pokemonCoordinates,
            {
                unit: 'meter',
                threshold: wantedDetails[0].radiusMeters
            });
    }
}
