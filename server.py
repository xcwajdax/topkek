"""
Minimal HTTP server that suppresses connection errors when the client
closes or aborts the connection before the response is fully sent
(e.g. refresh, large files, video seek / tab close; WinError 10053/10054).
"""
import errno
import sys
import os
from functools import partial

# Directory that contains index.html (this file lives next to it).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Match relative paths in HTML/JS; explicit `directory=` (Py3.7+) avoids listing
# the wrong folder if cwd was not topkek (e.g. `python path/to/server.py`).
os.chdir(SCRIPT_DIR)

try:
    from http.server import HTTPServer, SimpleHTTPRequestHandler
except ImportError:
    from BaseHTTPServer import HTTPServer
    from SimpleHTTPServer import SimpleHTTPRequestHandler

# Windows socket error when client resets connection
WSAECONNRESET = getattr(errno, "WSAECONNRESET", 10054)


class QuietHTTPRequestHandler(SimpleHTTPRequestHandler):
    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            # Client closed connection (refresh, navigate away, cancel, video seek) - ignore
            pass
        except OSError as e:
            # On Windows, closed socket often raises OSError (10054 reset, 10053 abort)
            winerror = getattr(e, "winerror", None)
            if e.errno in (errno.ECONNRESET, errno.EPIPE, WSAECONNRESET) or winerror in (
                10053,
                10054,
            ):
                pass
            else:
                raise

    def log_message(self, format, *args):
        # Optional: keep request log, or comment out to make fully quiet
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    if sys.version_info >= (3, 7):
        handler_cls = partial(QuietHTTPRequestHandler, directory=SCRIPT_DIR)
    else:
        handler_cls = QuietHTTPRequestHandler
    server = HTTPServer(("", port), handler_cls)
    print(
        "Serving %s at http://localhost:%s (client disconnect noise suppressed)"
        % (SCRIPT_DIR, port)
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
