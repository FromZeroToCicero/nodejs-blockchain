# Blockchain project with NodeJS & Express

In this project, I have created a blockchain-like data structure with Express, NodeJS and JavaScript, that mimics how the Bitcoin blockchain works. This project has taught me how a blockchain works, how transactions are created and stored inside blocks and how these blocks get mined by nodes in a decentralised network.

## Running locally

1. Clone the project on your local device.

2. Install the dependencies using the follow command:

    ```
    npm install
    ```

3. There are 5 commands to run for starting up to 5 blockchain nodes simultaneously (you will need up to 5 separate terminal windows for this):

    ```
    npm run node_{id}, where id=1,2,3,4,5
    ```

4. You can view the blockchain structure at `localhost:300{id}/blockchain`. I recommend getting the JSON-formatter Chrome extension so you can view the data formatted. I have posted the link for this extension in the `Useful links` section.

5. If you want to test things out, I have created a Postman collection with all the endpoints you could interact with, in order to fully experience what this blockchain can offer - [Postman collection](https://www.getpostman.com/collections/6f23bf72550eb5951796)

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.

## Useful links

* [JSON Formatter Chrome extension](https://github.com/callumlocke/json-formatter)
* [Learn Blockchain by building your own in JavaScript - Eric Traub](https://www.udemy.com/course/build-a-blockchain-in-javascript/)