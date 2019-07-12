#!/bin/sh
# ------------------------------------------------------
# Token Issuance system start script.
# ------------------------------------------------------

PATH_HOME=$(pwd)
PATH_TIS="$PATH_HOME/token_issuance_system"
PATH_TIS_LOGS="$PATH_TIS/logs"
PATH_WEBSITE="$PATH_HOME/website" 

echo "$PATH_HOME"
echo "$PATH_TIS"
echo "$PATH_TIS_LOGS"
echo "$PATH_WEBSITE"
echo $1

[ -d "$PATH_TIS_LOGS" ] || mkdir "$PATH_TIS_LOGS"

[ -f "$PATH_TIS_LOGS/forever.log" ] && rm "$PATH_TIS_LOGS/forever.log"
[ -f "$PATH_TIS_LOGS/out.log" ] && rm "$PATH_TIS_LOGS/out.log"
[ -f "$PATH_TIS_LOGS/err.log" ] && rm "$PATH_TIS_LOGS/err.log"
cd "$PATH_TIS"
npm install
rm -r node_modules/bitcore-insight/node_modules/bitcore-lib/
forever start -l "$PATH_TIS_LOGS/forever.log" -o "$PATH_TIS_LOGS/out.log" -e "$PATH_TIS_LOGS/err.log" "./bin/www"

[ -f "$PATH_TIS_LOGS/w_forever.log" ] && rm "$PATH_TIS_LOGS/w_forever.log"
[ -f "$PATH_TIS_LOGS/w_out.log" ] && rm "$PATH_TIS_LOGS/w_out.log"
[ -f "$PATH_TIS_LOGS/w_err.log" ] && rm "$PATH_TIS_LOGS/w_err.log"

cd "$PATH_WEBSITE"
npm install
#forever start -l "$PATH_TIS_LOGS/w_forever.log" -o "$PATH_TIS_LOGS/w_out.log" -e "$PATH_TIS_LOGS/w_err.log" node_modules/@angular/cli/bin/ng serve --host=$1 --port=80
#forever start -l "$PATH_TIS_LOGS/w_forever.log" -o "$PATH_TIS_LOGS/w_out.log" -e "$PATH_TIS_LOGS/w_err.log" node_modules/@angular/cli/bin/ng serve --host=0.0.0.0 --port=80 --public-host="sphinks.org"
forever start -l "$PATH_TIS_LOGS/w_forever.log" -o "$PATH_TIS_LOGS/w_out.log" -e "$PATH_TIS_LOGS/w_err.log" node_modules/@angular/cli/bin/ng serve --host=0.0.0.0 --port=80 --disable-host-check=true

forever list




