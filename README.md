# FlaskForge 🍪

I built this because I couldn't find a single decent tool online that handles Flask session cookies properly — most decoders don't encode, most encoders don't verify, and none of them crack. So I made one that does all three.

## What it does

- **Decode** — paste any Flask session cookie and see the JSON payload, timestamp, and signature breakdown instantly
- **Encode** — craft a valid signed cookie from a JSON payload and your own SECRET_KEY
- **Verify** — check if a SECRET_KEY matches a given cookie's signature
- **Crack Token** — bruteforce weak secret keys against a 55k+ wordlist of common Flask secrets, runs entirely in your browser

## Live

**[razvanttn.github.io/FlaskForge](https://razvanttn.github.io/FlaskForge)**

No install. No backend. Everything runs client-side.

## How Flask session cookies work

Flask session cookies have three parts separated by `.`:

```
eyJ1c2VybmFtZSI6ImFkbWluIn0.ZxYt2A.abc123signature
      ^payload (base64)       ^timestamp  ^HMAC-SHA1
```

The payload is just base64-encoded JSON — readable by anyone. The signature is HMAC-SHA1 computed with the app's `SECRET_KEY`. Without the key you can read the data but can't forge it.

This tool covers all four operations you'd need when dealing with Flask cookies during a CTF or a pentest.

## Usage

Just open the link above. Pick a tab, paste your cookie, go.

For the **Crack Token** tab — the built-in wordlist covers the most common weak secrets people actually deploy. You can also upload your own `.txt` wordlist if you need something more targeted.

## Disclaimer

Use this on applications you own or have explicit permission to test. CTFs, your own projects, authorized pentests. That's it.

## Contact

- Discord: `razvanttn_`
- Writeups: [razvanttn.gitbook.io/ctf](https://razvanttn.gitbook.io/ctf)
