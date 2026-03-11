"""
Minimal HTTP server that suppresses ConnectionResetError when the client
closes the connection before the response is fully sent (e.g. refresh, large files).
"""
import sys
import os

# Run from script's directory so paths match start.bat behaviour
os.chdir(os.path.dirname(os.path.abspath(__file__)))

try:
    from http.server import HTTPServer, SimpleHTTPRequestHandler
except ImportError:
    from BaseHTTPServer import HTTPServer
    from SimpleHTTPServer import SimpleHTTPRequestHandler


class QuietHTTPRequestHandler(SimpleHTTPRequestHandler):
    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, BrokenPipeError):
            # Client closed connection (refresh, navigate away, cancel) - ignore
            pass

    def log_message(self, format, *args):
        # Optional: keep request log, or comment out to make fully quiet
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    server = HTTPServer(("", port), QuietHTTPRequestHandler)
    print("Serving at http://localhost:%s (ConnectionResetError suppressed)" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
