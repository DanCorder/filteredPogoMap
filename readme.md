## Running Locally ##

If you want to test against a local dynamoDB instance then you will need to download and setup dynamoDB from Amazon. See http://docs.aws.amazon.com/amazondynamodb/latest/gettingstartedguide/intro-dynamodb-local.html.

Copy the contents of node-lambda-templates to the root directory.
Search for qq in those files and set your secret values.
run 'npm run with\_local\_db' or 'npm run with\_live\_db'

Note that this project doesn't include a local substitute for the twitter API, so if you want to test the filter fully offline you'll need to work something out.