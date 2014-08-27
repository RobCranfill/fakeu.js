/*
	A simple GUI for heyu - Node.js version.

	23/Aug/2014 - First js version, with no client screen size accomodations.
	24/Aug/2014 - 2nd version - does do screen size accomodations (in the css, actually).
	
	Copyright (C) 2014 Rob Cranfill (robcranfill@gmail.com)
	
		This program is free software; you can redistribute it and/or modify
		it under the terms of the GNU General Public License as published by
		the Free Software Foundation; either version 2 of the License, or
		(at your option) any later version.
		
		This program is distributed in the hope that it will be useful,
		but WITHOUT ANY WARRANTY; without even the implied warranty of
		MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
		GNU General Public License for more details.
		
		You should have received a copy of the GNU General Public License along
		with this program; if not, write to the Free Software Foundation, Inc.,
		51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

*/

// Perhaps cuz I'm a Java programmer, I like to name these sorts of things -  
// Classes, right? Or class-like things, anyway - with an initial upper case letter.
//
var ChildProcess	= require("child_process");
var Fs						= require("fs");
var Http					= require("http");
var Path					= require("path");
var QueryString		= require("querystring");
var Stream				= require("stream");
var Url						= require("url");

// Simple global vars - named with an underscore after.
// 
var requestCount_ = 0;
var heyuCount_ = 0;

// "Content types" map - the only things we'll serve. For now, just .css.
//
var contentTypes_ = {
//	'.htm' : 'text/html',
//	'.html': 'text/html',
//	'.js'  : 'text/javascript',
//	'.json': 'application/json',
	'.css' : 'text/css',
	'.png' : 'image/png'
	};


/*
  This is where we handle each URL request.

    Path                            Action
    --------------                  --------------
    /fakeu                          Show main HTML page

    /fakeu?unitCode=A1&action=on    Turn A1 on - invoke "heyu fon A1"
                                    Action is "on" or "off"
*/
function router(req, resp) {

	requestCount_++;
	
	var url = req.url;
  var parsedURL = Url.parse(url);

  console.log("-----------------------------------");
  console.log("Request #" + requestCount_ + " for path " + parsedURL.pathname + " received.");
//  console.log("Routing a request for " + parsedURL.pathname);
//	console.log('  search: ' + parsedURL.search);
//	console.log('   query: ' + parsedURL.query);
//	console.log('pathname: ' + parsedURL.pathname);
//	console.log('    path: ' + parsedURL.path);
//	console.log('    href: ' + parsedURL.href);

	if (parsedURL.path === "/fakeu") {

		console.log("Loading main page....");

		// Find out what browser is in use, to use the right CSS file
		// to scale the GUI appropriately.
		//
		userAgent = req.headers["user-agent"];
		console.log("userAgent: " + userAgent);
		var cssFileName = "fakeu_other.css";
		if (userAgent.indexOf("Nexus 7") > -1) {
			cssFileName = "fakeu_nexus.css";
			}
		else
		if (userAgent.indexOf("iPhone") > -1) {
			cssFileName = "fakeu_iphone.css";
			}
		console.log("CSS file: " + cssFileName);

		// Open the (mostly) static HTML file we will serve.
		//
		var fileStream = Fs.createReadStream("fakeuMain.html");
		fileStream.on('error', function(error) {
			if (error.code === 'ENOENT') {
				resp.statusCode = 404;
				resp.end(Http.STATUS_CODES[404]);
				console.log("!Error 404 on fakeuMain.html!");
				console.log("!Error is: " + error);
				}
			else {
				resp.statusCode = 500;
				resp.end(Http.STATUS_CODES[500]);
			console.log("!Error 500 on fakeuMain.html!");
				}
			});
		console.log("File loaded.");

		// Instead of simply piping the file to the response, like this:
		//		fileStream.pipe(resp);
		// we transform the stream, substituting the name of the CSS file to use.
		//
		var parser = new Stream.Transform();
		parser._transform = function(data, encoding, done) {
			var dataAsString = data.toString().replace("_CSS_FILE_NAME_", cssFileName);
//			console.log("Transformed:\n-- in --\n" + data + "\n-- out --\n" + dataAsString);
			this.push(dataAsString);
			done();
			};

		// Pipe the streams
		//
		resp.writeHead(200, {"Content-Type": "text/html"});
		fileStream.pipe(parser).pipe(resp);

		console.log("Page served");
		return;
		} // path '/fakeu'


	// We are looking to handle a request like:
	//  http://host:8888/fakeu?unitCode=A1&action=on
	//
	if (parsedURL.query) {
	
		var parsedQuery = QueryString.parse(parsedURL.query);
		console.log("parsedQuery: " + JSON.stringify(parsedQuery));

		var unitCode = parsedQuery["unitCode"];
		var action   = parsedQuery["action"];
		console.log("unitCode: " + unitCode + "; action: " + action);
	
		// Check for OK values
		// TODO: CHECK UNIT CODE
		//
		if (action !== "on" & action !== "off") {
			console.log("!Bad action (" + action + ")!");
			handleBadRequest(resp, 404);
			return;
			}

		// Execute heyu!
		// I am using a "Firecracker", so the heyu commands are actually "fon" and "foff".
		//
		heyuCount_++;
		var heyuCommand = "/usr/local/bin/heyu f" + action + " " + unitCode;
		console.log("heyu command #" + heyuCount_ + ": '" + heyuCommand + "'");

		ChildProcess.exec(heyuCommand, function (error, stdout, stderr) {
			if (error) {
				console.log("Result from heyu.cmd: " + error);
				console.log("stdout: '" + stdout + "'");
				console.log("stderr: '" + stderr + "'");
				}
			});

		// If we don't end the response, the browser isn't happy.
		// Doing this without sending any response content seems to keep 
		// us on the same (main) page, which is good.
		//
		resp.end();
		return;
		} // parsedURLQuery OK
	

	// At this point, it's not a request for the main page, or for a 'heyu' command.
	// It may be a request for a supporting page, such as a .css file.
	//
  // Get the extension; is it a type that we can/will handle?
  //
  var extension = Path.extname(url);
	console.log("Checking extension for '" + parsedURL.path + "': '" + extension + "'");

  // Read the extension against the content type map - default to plain text.
  //
	if (extension.length > 0) {
		if (!contentTypes_[extension]) {
			console.log("!Unknown content type! (" + extension + ")");
			handleBadRequest(resp, 404);
			return;
			}
		var contentType = contentTypes_[extension];
		console.log("contentType OK: " + contentType);

		// Serve the file
		//
		var filename = Path.basename(parsedURL.path);
		console.log("Serving file: " + filename);
		var fileStream = Fs.createReadStream(filename);
		fileStream.on('error', function(error) {
			if (error.code === 'ENOENT') {
				resp.statusCode = 404;
				resp.end(Http.STATUS_CODES[resp.statusCode]);
				console.log("!Error 404 on '" + filename + "'!");
				} 
			else {
				resp.statusCode = 500;
				resp.end(Http.STATUS_CODES[resp.statusCode]);
				console.log("!Error 500 on '" + filename + "'!");
				}
			});

		resp.writeHead(200, {"Content-Type": contentType});
		fileStream.pipe(resp);

		console.log("File served.");
		return;
		}


	// Any other request comes here. Reply with a "400: Bad Request"
	//
	handleBadRequest(resp, 400);
	console.log("!Fell out of end of router; replying with 400 error!");
	}


/*
	Emit the indicated HTTP status code.
*/
function handleBadRequest(resp, code) {
	resp.statusCode = code;
	resp.end(Http.STATUS_CODES[code]);
	}


/*
	Handle an HTTP request.
*/
function onRequest(request, response) {
	if (request.method !== "GET") {
		console.log("!Not a GET!");
		handleBadRequest(response, 404); // *could* do a 405 if we then sent the 'Allow' header. meh.
		return;
		}
	router(request, response);
	console.log("Request routed");
	}
	
	
/*
	Here we are now: the main code.
	Start the 'router', handling requests.
*/
Http.createServer(onRequest).listen(8888);
console.log("Server has started on port 8888.");


// End of program.
