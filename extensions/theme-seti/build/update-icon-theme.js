/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

var path = require('path');
var fs = require('fs');
var https = require('https');
var url = require('url');

function getCommitSha(repoId, repoPath) {
	var commitInfo = 'https://api.github.com/repos/' + repoId + '/commits?path=' + repoPath;
	return download(commitInfo).then(function (content) {
		try {
			let lastCommit = JSON.parse(content)[0];
			return Promise.resolve({
				commitSha: lastCommit.sha,
				commitDate: lastCommit.commit.author.date
			});
		} catch (e) {
			return Promise.resolve(null);
		}
	}, function () {
		console.err('Failed loading ' + commitInfo);
		return Promise.resolve(null);
	});
}

function download(urlString) {
	return new Promise((c, e) => {
		var _url = url.parse(urlString);
		var options = { host: _url.host, port: _url.port, path: _url.path, headers: { 'User-Agent': 'NodeJS' }};
		var content = '';
		var request = https.get(options, function (response) {
			response.on('data', function (data) {
				content += data.toString();
			}).on('end', function () {
				c(content);
			});
		}).on('error', function (err) {
			e(err.message);
		});
	});
}

function invertColor(color) {
	var res = '#'
	for (var i = 1; i < 7; i+=2) {
		var newVal = 255 - parseInt('0x' + color.substr(i, 2), 16);
		res += newVal.toString(16);
	}
	return res;
}


exports.update = function () {
	var fontMappings = 'https://raw.githubusercontent.com/jesseweed/seti-ui/master/styles/_fonts/seti.less';
	console.log('Reading from ' + fontMappings);
	var def2Content = {};
	var ext2Def = {};
	var fileName2Def = {};
	var def2ColorId = {};
	var colorId2Value = {};

	function writeFileIconContent(info) {
		var iconDefinitions = {};

		for (var def in def2Content) {
			var entry = { fontCharacter: def2Content[def] };
			var colorId = def2ColorId[def];
			if (colorId) {
				var colorValue = colorId2Value[colorId];
				if (colorValue) {
					entry.fontColor = colorValue;

					var entryInverse = { fontCharacter: entry.fontCharacter, fontColor: invertColor(colorValue) };
					iconDefinitions[def + '_light'] = entryInverse;
				}
			}
			iconDefinitions[def] = entry;
		}

		function getInvertSet(input) {
			var result = {};
			for (var assoc in input) {
				let invertDef = input[assoc] + '_light';;
				if (iconDefinitions[invertDef]) {
					result[assoc] = invertDef;
				}
			}
			return result;
		}

		var res = {
			fonts: [{
				id: "seti",
				src: [{ "path": "./seti.woff", "format": "woff" }],
				weight: "normal",
				style: "normal",
				size: "150%"
			}],
			iconDefinitions: iconDefinitions,
		//	folder: "_folder",
			file: "_default",
			fileExtensions: ext2Def,
			fileNames: fileName2Def,
			light: {
				file: "_default_light",
				fileExtensions: getInvertSet(ext2Def),
				fileNames: getInvertSet(fileName2Def)
			},
			version: 'https://github.com/jesseweed/seti-ui/commit/' + info.commitSha,
		};
		fs.writeFileSync('./icons/seti-icon-theme.json', JSON.stringify(res, null, '\t'));

	}


	var match;

	return download(fontMappings).then(function (content) {
		var regex = /@([\w-]+):\s*'(\\E[0-9A-F]+)';/g;
		while ((match = regex.exec(content)) !== null) {
			def2Content['_' + match[1]] = match[2];
		}

		var mappings = 'https://raw.githubusercontent.com/jesseweed/seti-ui/master/styles/icons/mapping.less';
		return download(mappings).then(function (content) {
			var regex2 = /\.icon-(?:set|partial)\('([\w-\.]+)',\s*'([\w-]+)',\s*(@[\w-]+)\)/g;
			while ((match = regex2.exec(content)) !== null) {
				let pattern = match[1];
				let def = '_' + match[2];
				let colorId = match[3];
				if (pattern[0] === '.') {
					ext2Def[pattern.substr(1)] = def;
				} else {
					fileName2Def[pattern] = def;
				}
				def2ColorId[def] = colorId;
			}
			var colors = 'https://raw.githubusercontent.com/jesseweed/seti-ui/master/styles/ui-variables.less';
			return download(colors).then(function (content) {
				var regex3 = /(@[\w-]+):\s*(#[0-9a-z]+)/g;
				while ((match = regex3.exec(content)) !== null) {
					colorId2Value[match[1]] =  match[2];
				}
				return getCommitSha('jesseweed/seti-ui', 'styles/_fonts/seti.less').then(function (info) {
					try {
						writeFileIconContent(info);
						if (info) {
							console.log('Updated to jesseweed/seti-ui@' + info.commitSha.substr(0, 7) + ' (' + info.commitDate.substr(0, 10) + ')');
						}
					} catch (e) {
						console.error(e);
					}
				});
			});		
		});
	}, console.error);
}

if (path.basename(process.argv[1]) === 'update-icon-theme.js') {
	exports.update();
}



