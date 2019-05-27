var app = app || {};

app.initApp = async () => {
    window.arkaneConnect = new ArkaneConnect('Arketype', {environment: 'staging'});
    try {
        const authenticationResult = await window.arkaneConnect.checkAuthenticated();
        app.afterAuthentication(authenticationResult);
    } catch (reason) {
        console.error(reason);
    }
};

app.afterAuthentication = (authenticationResult) => {
    authenticationResult
        .authenticated(async (auth) => {
            console.log('This user is authenticated', auth);
            document.body.classList.add('logged-in');
            $('#auth-username').text(auth.idTokenParsed.name);

            try {
                const hasWallets = app.refreshWallets();
                if (!hasWallets) {
                    const result = await window.arkaneConnect.flows.manageWallets('ETHEREUM');
                    if(result.status === 'SUCCESS') {
                        app.refreshWallets();
                    }
                }
            } catch (err) {
                console.error('Something went wrong while fetching the user\'s wallets');
            }
        })
        .notAuthenticated((auth) => {
            console.log('This user is not authenticated', auth);
        });
};

app.refreshWallets = async () => {
    const wallets = await window.arkaneConnect.api.getWallets();
    if (wallets.length > 0) {
        const walletsMap = app.convertArrayToMap(wallets, 'id');
        localStorage.setItem('wallets', JSON.stringify(walletsMap));
        app.populateWalletsSelect(wallets);
        return true;
    } else {
        return false;
    }
};

app.convertArrayToMap = (array, key) => {
    return array.reduce((obj, item) => {
        obj[item[key]] = item;
        return obj;
    }, {});
};

app.populateWalletsSelect = (wallets) => {
    const walletsSelect = $('#wallets-select');
    wallets.forEach((wallet) => {
        walletsSelect.append($('<option>', {value: wallet.id}).text(`${wallet.secretType} - ${wallet.address}`));
    });
};

app.preFillTransactionTokens = (wallet, tokenBalances) => {
    const transactionTokens = $('#transaction-token');
    transactionTokens.empty();
    transactionTokens.append($('<option>', {value: ''}).text(wallet.balance.symbol));
    tokenBalances.forEach((tokenBalance) => {
        transactionTokens.append(
            $('<option>', {value: tokenBalance.tokenAddress}).text(tokenBalance.symbol)
        );
    });
};

app.initApp();

$('#auth-loginlink').click(async (event) => {
    event.preventDefault();
    const authenticationResult = await window.arkaneConnect.flows.authenticate();
    app.afterAuthentication(authenticationResult);
});

$('#auth-logout').click((event) => {
    event.preventDefault();
    window.arkaneConnect.logout();
});

$('#manage-eth-wallets').click(async (event) => {
    event.preventDefault();
    const result = await window.arkaneConnect.flows.manageWallets('ETHEREUM');
    if(result.status === 'SUCCESS') {
        app.refreshWallets();
    }
});

$('#manage-vechain-wallets').click(async (event) => {
    event.preventDefault();
    const result = await window.arkaneConnect.flows.manageWallets('VECHAIN');
    if(result.status === 'SUCCESS') {
        app.refreshWallets();
    }
});

$('#wallets-select').change(async (event) => {
    event.preventDefault();
    if (event.target.value) {
        const wallets = JSON.parse(localStorage.getItem('wallets'));
        const wallet = wallets[event.target.value];
        $('#wallet-address').html(wallet.address);
        $('#wallet-balance').html(`${wallet.balance.balance} ${wallet.balance.symbol}`);
        $('#wallet-gas-balance').html(`${wallet.balance.gasBalance} ${wallet.balance.gasSymbol}`);

        const tokenBalances = await window.arkaneConnect.api.getTokenBalances(wallet.id);
        $('#wallet-tokens').html(
            tokenBalances.map((tokenBalance) => `${tokenBalance.balance} ${tokenBalance.symbol}`).join('<br/>')
        );

        $('#secret-type').val(wallet.secretType);
        app.preFillTransactionTokens(wallet, tokenBalances);

        $('#selected-wallet').removeClass('hidden');
    } else {
        $('#selected-wallet').addClass('hidden');
    }
});

$('#transaction-form').submit(async (event) => {
    event.preventDefault();
    const signer = window.arkaneConnect.createSigner();

    try {
        const transactionResult = await signer.executeTransaction(
            {
                walletId: $('#transaction-form select[name=\'from\']').val(),
                to: $('#transaction-form input[name=\'to\']').val(),
                value: ($('#transaction-form input[name=\'amount\']').val()),
                secretType: $('#transaction-form input[name=\'secretType\']').val(),
                tokenAddress: $('#transaction-form select[name=\'tokenAddress\']').val(),
            }
        );
        console.log(transactionResult.result.transactionHash);
    } catch (reason) {
        console.error(reason);
    }
});
