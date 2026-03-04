async function rawFetch(url, method = 'GET', headers = {}, body = null) {
    const res = await fetch('https://upsahostels.com' + url, {
        method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...headers
        },
        body,
        redirect: 'manual' // We want to see the 302
    });
    return {
        status: res.status,
        headers: res.headers,
        body: await res.text()
    };
}

const parseCookies = (res) => {
    // getSetCookie() is available in Node 18+ for headers
    if (res.headers.getSetCookie) {
        return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    }
    const cookies = res.headers.get('set-cookie');
    if (!cookies) return '';
    return cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
};

async function tryLogin(username, password) {
    console.log(`\n--- Trying Login for ${username} ---`);
    const init = await rawFetch('/index.php?r=site/login');
    const initialCookie = parseCookies(init);

    // CSRF match
    const csrfMatch = init.body.match(/<meta name="csrf-token" content="([^"]+)">/);
    const csrf = csrfMatch ? csrfMatch[1] : '';
    console.log('Got CSRF:', csrf);

    const loginBody = `_csrf-frontend=${encodeURIComponent(csrf)}&LoginForm%5Busername%5D=${encodeURIComponent(username)}&LoginForm%5Bpassword%5D=${encodeURIComponent(password)}&login-button=`;

    const loginRes = await rawFetch('/index.php?r=site/login', 'POST', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': initialCookie
    }, loginBody);

    console.log('Login Status:', loginRes.status);
    if (loginRes.status === 302) {
        console.log('SUCCESS: Login worked!');
        return parseCookies(loginRes) + '; ' + initialCookie;
    }
    return null;
}

async function run() {
    let authCookies = await tryLogin('812510', '1klKma1r');
    if (!authCookies) {
        authCookies = await tryLogin('10287532', 'Feb@2003');
    }

    if (!authCookies) {
        console.log('FAILED to login with all known credentials.');
        return;
    }

    console.log('\n--- SEARCH (10325100) ---');
    const indexNum = '10325100';
    const searchPath = `/index.php?RegistrationListSearch%5Bstu_index_number%5D=${indexNum}&r=student%2Fregistration-list%2Findex`;
    const searchRes = await rawFetch(searchPath, 'GET', {
        'Cookie': authCookies
    });

    console.log('Search Status:', searchRes.status);
    if (searchRes.body.includes(indexNum)) {
        console.log('SUCCESS: Student 10325100 found!');
    } else {
        console.log('FAILURE: Student 10325100 not found.');
    }

    console.log('\n--- SEARCH BY NAME (ABIDJA) ---');
    const nameSearchPath = `/index.php?RegistrationListSearch%5Bname%5D=ABIDJA&r=student%2Fregistration-list%2Findex`;
    const nameSearchRes = await rawFetch(nameSearchPath, 'GET', {
        'Cookie': authCookies
    });
    if (nameSearchRes.body.includes(indexNum)) {
        console.log('SUCCESS: Found student 10325100 in name search results!');
    } else {
        console.log('FAILURE: Student 10325100 not found in name search.');
    }
}

run().catch(console.error);
