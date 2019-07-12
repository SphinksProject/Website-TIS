## Running the Website along with the Token Issuance System

You need to have [Forever](https://www.npmjs.com/package/forever) installed.

### Forever setup on Debian

```sh
# Update Homebrew
apt update

# Install forever
[sudo] npm install forever -g

```

### Run server

```sh
./start_server.sh
```

### Stop server

```sh
./stop_server.sh
```

### Watch logs

```sh
#current session log
cat token_issuance_system/logs/forever.log 

#all logs
cat token_issuance_system/logs/all.log 
```
