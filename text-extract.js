const path = require('path');
const extract = require('pdf-text-extract');
const download = require('download-pdf');
const request = require('request');
const util = require('util');
const fs = require('fs');
const filePath = path.join(__dirname, 'resume.pdf');
const excelPath = path.join(__dirname, 'candidates.xlsx'); 
const solrNode = require('solr-node');
const readXlsxFile = require('read-excel-file/node');
const getPageCount = require('docx-pdf-pagecount');
const promise = require("bluebird");

let reqOptions = {
	url: "",
	followRedirect: true,
	method: "GET",
	encoding: null,
	headers: {
		"Content-type": "application/pdf"
	}
};

// Create client
const solrClient = new solrNode({
	host: '127.0.0.1',
	port: '8983',
	core: 'exp_resumes',
	protocol: 'http'
});

 
 // get page size
function pageSize() {
 	return new Promise((resolve, reject) => {
 		getPageCount(filePath)
		  .then(pages => {
		    resolve(pages);
		  })
		  .catch((err) => {
		    reject(0);
		  });
 	});		
 };

// download file
let downloadPDF = () => {
	return new Promise((resolve, reject) => {
		request(reqOptions, (error, res, body) => {
			if (error) reject(error);
			let writeStream = fs.createWriteStream('resume.pdf');
			writeStream.write(body, 'binary');
			writeStream.on('finish', () => {
				console.log('wrote all data to file');
				resolve();
			});
			writeStream.end();
		});
	});
};

// read excel file
readXlsxFile(excelPath).then( async (rows) => {
  	downloadAndParse(rows);
});

// function to download and parse rows
function downloadAndParse(rows) {
	promise.each(rows, async (row) => {
		reqOptions["url"] = row[6];
		let userData = {
			"name" : row[0],
			"email" : row[1],
			"location" : String(row[2]),
			"graduation_year" : row[3],
			"institute": String(row[4]),
			"cgpa": String(row[5]),
			"resume_url" : String(row[6]),
			"company": String(row[7]),
			"designation": String(row[8]),
			"phone_number": String(row[9]),
			"degree": String(row[10]),
			"stream": String(row[11]),
			"years_of_exp" : String(row[12]),
			"gender" : String(row[13]),
			"total_score" : String(row[16]),
		}
		await downloadPDF().then(
		async () => {
			try {
				console.log(userData);
				console.log(`downloaded file successfully`);
				let sizeOfPage = await pageSize();
				console.log(`size of page is ${sizeOfPage}`);
				if (sizeOfPage > 0 && sizeOfPage < 5) {
					await extractText(userData);
				}
			} catch(e) {
				console.error(e);
			}
		}).catch(error => { 
			console.error(error);
		});
	});
}


// function to extract text
function extractText(data) {
	console.log("extracted file");
	return new Promise((resolve, reject) => {
		extract(filePath, { splitPages: false }, async (err, pages) => {
			if (err) {
				reject();
			}
			if (pages != "undefined" || pages != null || pages != "") {
				data["resume_data"] = pages.join(' ').trim().replace(/ +(?= )/g,'').replace(/\s+/g, ' ');
			}
			await pushToSolr(data);
			resolve();
		});
	});
}


// function to check key element
function checkKeyElements(pages) {
	console.log("checking key elements");
	pages.forEach((page) => {
		let isFound = page.includes("Golang", "Kubernetes", "Docker", "AWS", "aws" , "kubernetes", "docker", "golang", "azure", "Azure", "GCP", "gcp", "container", "cloud");
		if (isFound) {
			console.log("this candidate can be viewed once");
		}
	});
}


// function to push to solr
async function pushToSolr(data) {
	console.log("pushing to solr");
	try {
		const result = await solrClient.update(data);
		console.log('Response:', result);
	} catch(e) {
		console.error(e);
	}
}

function sleep(ms){
    return new Promise(resolve=>{
    	console.log("sleep")
        setTimeout(resolve,ms)
    })
}

