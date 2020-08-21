const fs = require("fs");
const path = require("path");
const puppeteer = require('puppeteer-extra')
 
// Add adblocker plugin, which will transparently block ads in all pages you
// create using puppeteer.
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({
    blockTrackers: true,
}))

const baseURL = "https://mediabiasfactcheck.com";

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    

    const a = ["left", "leftcenter", "center", "right-center", "right"];
    let sources = [];
    
    console.log("----[ START GATHERING OF SOURCES ]----");
    for (let i = 0; i < a.length; i++) {
        var j = a[i];

        console.log(`We are currently gathering sources for ${j} bias`);
        await page.goto(`${baseURL}/${j}`);

        // get element #mbfc-table
        await page.waitForSelector("#mbfc-table", { timeout: 120000 });
        const list = await page.$("#mbfc-table");
        
        const srcs = await list.$$eval('tbody tr td a', (nodes, bias) => nodes.map(n => ({
            title: n.innerText,
            src: n.href,
            bias,
        })), j);

        sources = [...sources, ...srcs];
        console.log(`    Found a total of ${srcs.length} ${j}-biased sources`);
    }

    console.log("----[ END GATHERING SOURCES ]----")
    console.log(`We gathered a total of ${sources.length} sources!`);

    console.log("----[ START ANALYZING SOURCES ]----");

    let results = [];
    for (let i = 0; i < sources.length; i++) {
        try {
            const { title, src, bias } = sources[i];
        
            console.log(`    ${i}) Analyzing "${title}"...`);
            await page.goto(src);

            let reporting = null;

            const reportings = ['VERY HIGH', 'HIGH', 'MOSTLY FACTUAL', 'MIXED', 'LOW', 'VERY LOW'];
            for (let i = 0; i < reportings.length; i++) {
                const r = reportings[i];

                const match = await page.evaluate((r) => window.find(`Factual Reporting: ${r}`), r);

                if (match) {
                    reporting = r;
                    console.log("    | Reporting is", r);
                    break;
                }
            }

            if (!reporting) {
                console.log("    | Could not find reporting !!!")
            }

            let result = {
                title,
                analysisSource: src,
                bias,
                reporting,
            }
            results.push(result);   
        } catch (error) {
           console.error(error); 
        }
    }

    console.log("----[SUCCESS IN ANALYZE]----")
    console.log("----[SAVING TO DISK]----");

    const jsonResults = JSON.stringify(results);

    fs.writeFileSync(path.join(__dirname, "results.json"), jsonResults);
    console.log(`SUCCESS!!! SAVED ${results.length} REPORTS TO DISK`);
})();