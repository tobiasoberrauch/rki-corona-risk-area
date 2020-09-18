import * as fs from 'fs';
import { launch } from 'puppeteer';
import { load } from 'cheerio';
import * as mkdirp from 'mkdirp';
import * as path from 'path';

function shouldUseCache(indexFilepath: string) {
    return fs.existsSync(indexFilepath + '.html');
}

class Region {
    public name: string;
    public dateFrom: string;
}

class Country {
    public name: string;
    public dateFrom: string;
    public regions: Region[];
}

(async () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];

    const indexFilename = 'Risikogebiete_neu';
    const indexFilepath = `data/${date}/${indexFilename}`;

    const directory = path.dirname(indexFilepath + '.html');
    if (!fs.existsSync(directory)) {
        mkdirp.sync(directory);
    }

    if (!shouldUseCache(indexFilepath)) {
        const browser = await launch({
            devtools: false
        });
        const page = await browser.newPage();
        await page.goto('https://www.rki.de/DE/Content/InfAZ/N/Neuartiges_Coronavirus/Risikogebiete_neu.html');

        fs.writeFileSync(indexFilepath + '.html', await page.content());

        await browser.close();
    }

    const html = fs.readFileSync(indexFilepath + '.html', 'utf-8');
    const $ = load(html);

    const regex = /\(([^)]+)\)/;

    const countries = $('#main ul li').map((index: number, link: CheerioElement) => {
        let name = $(link).text();
        let country: Country = new Country();

        const matches = regex.exec(name);
        if (matches) {
            country.name = name.replace(regex, '').trim();
            country.dateFrom = matches[1];
        } else {
            country.name = name;
        }

        // has regions?
        const regions = $(link).find('ul li');
        if (regions.length > 0) {
            country.regions = regions.map((index: number, element: CheerioElement) => {
                const region: Region = new Region();
                const name = $(element).text();
                const matches = regex.exec(name);

                if (matches) {
                    region.name = name.replace(regex, '').trim();
                    region.dateFrom = matches[1];
                } else {
                    region.name = name;
                }
                return region;
            }).get();
        }

        return country;
    }).get();

    fs.writeFileSync(indexFilepath + '.json', JSON.stringify(countries, null, 4));
})();