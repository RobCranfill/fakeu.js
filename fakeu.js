/*
	A simple GUI for heyu - Node.js version.

	23/Aug/2014 - First js version, with no client screen size accomodations.
	
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

var Exec				= require('child_process');
var Fs				  = require("fs");
var Http				= require("http");
var Path				= require("path");
var Querystring	= require("querystring");
var Transform		= require('stream').Transform;
var Url					= require("url");


var requestCount_ = 0;
var heyuCount_ = 0;

// Content types map - the only things we'll serve
//
var contentTypes_ = {
//	'.htm' : 'text/html',
//	'.html': 'text/html',
//	'.js'  : 'text/javascript',
//	'.json': 'application/json',
	'.css' : 'text/css'
	};


/*
	Handle:
	
		Path													Action
		--------------								--------------
		/fakeu												Show main page
		
		/fakeu?unitCode=A1&action=on  Turn A1 on - invoke "heyu fon A1"
																	Action is "on" or "off"

*/
function router(req, resp) {

  console.log("-----------------------------------");
	requestCount_++;

	var url = req.url;
  var parsedURL = Url.parse(url);
  console.log("Request #" + requestCount_ + " for path " + parsedURL.pathname + " received.");

  console.log("Routing a request for " + parsedURL.pathname);

	console.log('  search: ' + parsedURL.search);
//	console.log('   query: ' + JSON.stringify(parsedURL.query));
	console.log('   query: ' + parsedURL.query);
	console.log('pathname: ' + parsedURL.pathname);
	console.log('    path: ' + parsedURL.path);
	console.log('    href: ' + parsedURL.href);


/*
	if (parsedURL.pathname !== "/fakeu") {
		console.log("!We don't offer that service!");
		handleBadRequest(resp);
		return;
		}
*/
	
	if (parsedURL.path === "/fakeu") {
	
//  	resp.writeHead(200, {"Content-Type": "text/plain"});
//		resp.write("This is the main fakeu page");

		console.log("Loading main page....");

		// Find out what browser is in use, to scale & modify the GUI appropriately.
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
	
		var fileStream = Fs.createReadStream("./fakeuMain.html");
		fileStream.on('error', function(error) {
			if (error.code === 'ENOENT') {
				resp.statusCode = 404;
				resp.end(Http.STATUS_CODES[404]);
			  console.log("!Error 404!");
				} 
			else {
				resp.statusCode = 500;
				resp.end(Http.STATUS_CODES[500]);
			  console.log("!Error 500!");
				}
			});
		console.log("File loaded.");
	
		resp.writeHead(200, {"Content-Type": "text/html"});
		
		
		// Instead of simply doing
		//		fileStream.pipe(resp);
		// we transform the stream, substituting the name of the CSS file to use.
		//
		var parser = new Transform();
		parser._transform = function(data, encoding, done) {
			var dataAsString = data.toString().replace("_CSS_FILE_NAME_", cssFileName);
			console.log("Transformed:\n-- in --\n" + data + "\n-- out --\n" + dataAsString);
			this.push(dataAsString);
			done();
			};

		// Pipe the streams
		//
		fileStream.pipe(parser).pipe(resp);

		console.log("Page served!");
		
		return;
		}

	// Hopefully, a request like:
	// http://localhost:8888/fakeu?unitCode=A1&action=on
	//
	if (parsedURL.query) {
	
		var parsedQuery = Querystring.parse(parsedURL.query);
	  console.log("parsedQuery: " + JSON.stringify(parsedQuery));
	  
		var unitCode = parsedQuery["unitCode"];
		var action   = parsedQuery["action"];
		console.log("unitCode: " + unitCode + "; action: " + action);
	
		// check for OK values
		// TODO: CHECK UNIT CODE
		if (action !== "on" & action !== "off") {
			console.log("!Bad action!");
			handleBadRequest(resp);
			return;
			}
		heyuCount_++;
		var heyuCommand = "/usr/local/bin/heyu f" + action + " " + unitCode;
		console.log("heyu command #" + heyuCount_ + ": '" + heyuCommand + "'");

		Exec.exec(heyuCommand, function (error, stdout, stderr) {
			if (error) {
				console.log("Result from heyu.cmd: " + error);
				console.log("stdout: '" + stdout + "'");
				console.log("stderr: '" + stderr + "'");
				}
			});

		// temporarily
		resp.writeHead(200, {"Content-Type": "text/plain"});
		resp.write("parsedURLQuery OK");
		resp.end();
		console.log("parsedURLQuery OK");
	
		return;
		} // parsedURLQuery
		



  // Get the extension; is it a special file we'll handle?
  var extension = Path.extname(url);
	console.log("Checking extension for '" + parsedURL.path + "': '" + extension + "'");

  // Read the extension against the content type map - default to plain text
	if (extension.length > 0) {
	
	  if (!contentTypes_[extension]) {
			console.log("!Unknown content type! (" + extension + ")");
			handleBadRequest(resp);
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
				resp.end(Http.STATUS_CODES[404]);
			  console.log("!Error 404!");
				} 
			else {
				resp.statusCode = 500;
				resp.end(Http.STATUS_CODES[500]);
			  console.log("!Error 500!");
				}
			});

		resp.writeHead(200, {"Content-Type": contentType});
		fileStream.pipe(resp);

		console.log("File served!");

		return;
		}


	// temporarily
	resp.writeHead(200, {"Content-Type": "text/plain"});
	resp.write("FELL OFF END");
	resp.end();
	console.log("FELL OFF END");

  console.log("End of router");
  
	}


function start(router) {

  function onRequest(request, response) {

  	if (request.method !== "GET") {
			console.log("!Not a GET!");
			handleBadRequest(response);
			return;
			}

    router(request, response);

    console.log("Request routed");
	  }

  Http.createServer(onRequest).listen(8888);
  console.log("Server has started.");
	}


function handleBadRequest(resp) {
	resp.statusCode = 404;
	resp.end('404\n');
	}

start(router);

