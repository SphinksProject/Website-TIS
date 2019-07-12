# token issuance system

## Running project

You need to have [Node.js](https://nodejs.org) and [MongoDB](https://www.mongodb.com) installed.

### Node setup on Debian

```sh
# Update Homebrew before installing all dependencies
apt update

# Install NodeJS
sudo apt-get install curl software-properties-common
curl -sL https://deb.nodesource.com/setup_11.x | sudo bash -
sudo apt-get install nodejs

# Install npm dependencies in project folder
npm install
```

### MongoDB setup on Debian

```sh
# Install MongoDB with Homebrew
apt-get install mongodb

# Create directory for MongoDB data
mkdir -p ./data/mongo

# Run MongoDB daemon process with path to data directory
mongod --dbpath ./data/mongo
```

### Run server

```sh
npm start
# alias for
node bin/www
```

