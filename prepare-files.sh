#DIRS ===============================================================================================================
if [ ! -d src/_outputs ]
  then :
    mkdir src/_outputs
fi
if [ ! -d src/_outputs/csv ]
  then :
    mkdir src/_outputs/csv
fi
if [ ! -d src/_outputs/json ]
  then :
    mkdir src/_outputs/json
fi
if [ ! -d src/_outputs/csv/checkers ]
  then :
    mkdir src/_outputs/csv/checkers
fi

#GENERAL ===============================================================================================================
if [ ! -s src/_inputs/settings/global.js ]
  then :
    echo "\nCreating global.js config in src/_inputs/settings/"
    cp src/_inputs/settings/global.example.js src/_inputs/settings/global.js
fi

if [ ! -s src/_inputs/csv/proxies.csv ]
  then :
    echo "\nCreating proxies.csv in src/_inputs/csv/"
    touch src/_inputs/csv/proxies.csv && echo "proxy_type,proxy" >> src/_inputs/csv/proxies.csv
fi

if [ ! -s src/_outputs/csv/checkers/balance-checker.csv ]
  then :
    echo "\nCreating balance-checker.csv in src/_outputs/csv/checkers/"
    touch src/_outputs/csv/checkers/balance-checker.csv && echo "id,walletAddress,amount,currency,network" >> src/_outputs/csv/checkers/balance-checker.csv
fi

#POLYHEDRA ===============================================================================================================
if [ ! -s src/_inputs/csv/polyhedra-wallets.csv ]
  then :
    echo "\nCreating polyhedra-wallets.csv in src/_inputs/csv/"
    touch src/_inputs/csv/polyhedra-wallets.csv && echo "id,walletAddress,privKey,okxAddress,secondAddress,proxy_type,proxy" >> src/_inputs/csv/polyhedra-wallets.csv
fi
if [ ! -s src/_outputs/json/polyhedra-wallets.json ]
  then :
    echo "\nCreating polyhedra-wallets.json in src/_outputs/json/"
    touch src/_outputs/json/polyhedra-wallets.json && echo "[]" >> src/_outputs/json/polyhedra-wallets.json
fi

if [ ! -s src/_outputs/csv/polyhedra-failed-wallets.csv ]
  then :
    echo "\nCreating polyhedra-failed-wallets.csv in src/_outputs/csv/"
    touch src/_outputs/csv/polyhedra-failed-wallets.csv && echo "id,walletAddress,privKey,failReason" >> src/_outputs/csv/polyhedra-failed-wallets.csv
fi

if [ ! -s src/_outputs/json/polyhedra-saved-modules.json ]
  then :
    echo "\nCreating polyhedra-saved-modules.json in src/_outputs/json/"
    touch src/_outputs/json/polyhedra-saved-modules.json && echo "[]" >> src/_outputs/json/polyhedra-saved-modules.json
fi

if [ ! -s src/_outputs/csv/checkers/polyhedra-claim.csv ]
  then :
    echo "\nCreating polyhedra-claim.csv in src/_outputs/csv/checkers/"
    touch src/_outputs/csv/checkers/polyhedra-claim.csv && echo "id,walletAddress" >> src/_outputs/csv/checkers/polyhedra-claim.csv
fi

#LAYER_ZERO ===============================================================================================================
if [ ! -s src/_inputs/csv/layer-zero-wallets.csv ]
  then :
    echo "\nCreating layer-zero-wallets.csv in src/_inputs/csv/"
    touch src/_inputs/csv/layer-zero-wallets.csv && echo "id,walletAddress,privKey,okxAddress,secondAddress,proxy_type,proxy" >> src/_inputs/csv/layer-zero-wallets.csv
fi
if [ ! -s src/_outputs/json/layer-zero-wallets.json ]
  then :
    echo "\nCreating layer-zero-wallets.json in src/_outputs/json/"
    touch src/_outputs/json/layer-zero-wallets.json && echo "[]" >> src/_outputs/json/layer-zero-wallets.json
fi

if [ ! -s src/_outputs/csv/layer-zero-failed-wallets.csv ]
  then :
    echo "\nCreating layer-zero-failed-wallets.csv in src/_outputs/csv/"
    touch src/_outputs/csv/layer-zero-failed-wallets.csv && echo "id,walletAddress,privKey,failReason" >> src/_outputs/csv/layer-zero-failed-wallets.csv
fi

if [ ! -s src/_outputs/json/layer-zero-saved-modules.json ]
  then :
    echo "\nCreating layer-zero-saved-modules.json in src/_outputs/json/"
    touch src/_outputs/json/layer-zero-saved-modules.json && echo "[]" >> src/_outputs/json/layer-zero-saved-modules.json
fi

if [ ! -s src/_outputs/csv/checkers/layer-zero-claim.csv ]
  then :
    echo "\nCreating layer-zero-claim.csv in src/_outputs/csv/checkers/"
    touch src/_outputs/csv/checkers/layer-zero-claim.csv && echo "id,walletAddress" >> src/_outputs/csv/checkers/layer-zero-claim.csv
fi
