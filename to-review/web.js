//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.primeobjects.com/
//  CONTACT:         developer@primeobjects.com
// 
//  This source is subject to the PrimeObjects License Agreements. 
// 
//  Our EULAs define the terms of use and license for each PrimeObjects product. 
//  Whenever you install a PrimeObjects product or research PrimeObjects source code file, you will be prompted to review and accept the terms of our EULA. 
//  If you decline the terms of the EULA, the installation should be aborted and you should remove any and all copies of our products and source code from your computer. 
//  If you accept the terms of our EULA, you must abide by all its terms as long as our technologies are being employed within your organization and within your applications.
// 
//  THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY
//  OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT
//  LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
//  FITNESS FOR A PARTICULAR PURPOSE.
// 
//  ALL OTHER RIGHTS RESERVED

import _ from './base';
const chromium = require('chrome-aws-lambda');
import { processTags, extendTags } from './data';
import { cleanHTML } from '../../shared/util/web';
import { summarize } from '../../shared/util/summarizer';
import axios from 'axios';
import AWS from 'aws-sdk';
import { solution } from '../../shared/metadata/solution';

// import cheerio from "cheerio";
const comprehend = new AWS.Comprehend();
import puppeteer from 'puppeteer-core';

// import puppeteer from 'puppeteer-extra';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

export const getWebPage = async (url, useChrome) => {
    let result = '';
    let browser = null;

    try {

        if (!useChrome) {
            return (await axios.get(url)).data;
        }

        // const StealthPlugin = require('puppeteer-extra-plugin-stealth')
        // puppeteer.use(StealthPlugin());

        // //Add adblocker plugin to block all ads and trackers (saves bandwidth)
        // const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
        // puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: false //chromium.headless,
        });

        const page = await browser.newPage();
      
        await page.goto(url, {
            waitUntil: 'networkidle2' //['networkidle0', 'load', 'domcontentloaded'],
        });
        result = await page.content();
        await page.close();

    }
    catch (ex) {
        console.error(ex);
    }
    finally {
        if (browser !== null) {
            await browser.close();
        }
    }
    return result;
};

export const getValueBySelector = ($, selecor, attrName) => {
    let v = null;
    $(selecor).each(function () {
        if (!_.isNonEmptyString(v)) {
            v = _.isNonEmptyString(attrName) ? $(this).attr(attrName) : $(this).text();
        }
    });
    return v;
};

export const findMainContentElement = ($, item) => {

    let biggestItem = null;
    item.find('>div,>article,>p,>section').each(function () {
        const curItem = $(this);
        const curItemSize = curItem.text().length;

        if (!biggestItem) {
            biggestItem = curItem;
        }
        else {
            if (biggestItem.text().length < curItemSize) biggestItem = curItem;
        }

    });

    if (biggestItem && 1.0 * biggestItem.text().length / item.text().length > 0.9) {
        return findMainContentElement($, biggestItem);
    }

    return item;
};


export const getCanonical = ($, protocol, host) => {
    const canonical = getValueBySelector($, 'head>link[rel="canonical"]', 'href');
    return _.isNonEmptyString(canonical) ? _.fixUrl(canonical, protocol, host) : null;
};

export const getTitle = ($, settings) => {

    if (!_.isObject(settings)) settings = {};

    let title = getValueBySelector($, 'head>title');

    if (!_.isNonEmptyString(title))  //og:title metadata
    {
        title = getValueBySelector($, 'head>meta[property="og:title"]', 'content');
    }

    if (!_.isNonEmptyString(title))  //twitter:title metadata
    {
        title = getValueBySelector($, 'head>meta[property="twitter:title"]', 'content');
    }

    if (!_.isNonEmptyString(title))  //title metadata
    {
        title = getValueBySelector($, 'head>meta[property="title"]', 'content');
    }

    if (!_.isNonEmptyString(title))  //h1
    {
        title = getValueBySelector($, 'h1');
    }

    return _.isNonEmptyString(title)? cleanHTML(title, { ...settings.cleanHTML, returnContent: 'text' }): '';
};


export const getCurrency = ($) => {
    return getValueBySelector($, 'meta[property="product:price:currency"],meta[property="og:price:currency"],meta[name="og:price:currency"]', 'content');
};

export const getPrice = ($, selector) => {
    //we always resepect the metadata first
    let price = getValueBySelector($, 'meta[property="product:price:amount"],meta[property="og:price:amount"],meta[name="og:price:amount"]', 'content');
    if (_.isNonEmptyString(price) && !_.isNaN(parseFloat(price))) {
        return parseFloat(price);
    }

    let label = getValueBySelector($, 'meta[name="twitter:label1"]', 'content');
    if (label == 'PRICE') {
        price = getValueBySelector($, 'meta[name="twitter:data1"]', 'content');
        if (_.isNonEmptyString(price) && !_.isNaN(parseFloat(price))) {
            return parseFloat(price);
        }
    }

    label = getValueBySelector($, 'meta[name="twitter:label2"]', 'content');
    if (label == 'PRICE') {
        price = getValueBySelector($, 'meta[name="twitter:data2"]', 'content');
        if (_.isNonEmptyString(price) && !_.isNaN(parseFloat(price))) {
            return parseFloat(price);
        }
    }

    if (_.isNonEmptyString(selector)) {
        $(selector).each(function () {
            if (!_.isNumber(price)) {
                let priceText = $(this).text();
                if (_.isNonEmptyString(priceText)) {
                    const priceMatch = priceText.match(/\d+/gi);
                    if (priceMatch)
                    {
                        priceText = priceMatch.join('.');
                        if (_.isNonEmptyString(priceText) && !_.isNaN(parseFloat(priceText))) {
                            price = parseFloat(priceText);
                        }
                    }
                    
                }
            }
        });
    }

    return price;
};

export const getContent = ($, selector, settings) => {

    if (selector == 'none') return '';
    if (selector == 'description' && _.isNonEmptyString(settings.description)) return settings.description;
   
    if (!_.isObject(settings)) settings = {};
    let result = '';
    if (_.isNonEmptyString(selector)) {
        $(selector).each(function () {
            let content = $(this).html().trim();
            if (content.length == 0 && _.isNonEmptyString($(this).attr('content'))) {
                content = $(this).attr('content');
            }
            result = result + ' ' + content;
        });
    }

    if (!_.isNonEmptyString(result)) {
        const content = $('body').html();
        if (_.isNonEmptyString(content)) {
            $ = cleanHTML(content, settings.cleanHTML);

            $('meta,head').remove();
            const body = $('body');
            if (body.length > 0) {
                const article = findMainContentElement($, body);
                if (article) result = article.html();
            }
        }
    }

    result = cleanHTML(result, { returnContent: 'html', cleanHTML: settings.cleanHTML });

    return _.isNonEmptyString(result) ? result : '';
};

export const getImage = ($, selector, protocol, host) => {

    let image = null;

    if (_.isNonEmptyString(selector)) 
    {
        image = getValueBySelector($, selector, 'src');
    }

    if (!_.isNonEmptyString(image))  
    {
        image = getValueBySelector($, 'head>meta[property="og:image"]', 'content');
    }

    if (!_.isNonEmptyString(image))  
    {
        image = getValueBySelector($, 'head>meta[property="twitter:image:src"]', 'content');
    }

    return _.isNonEmptyString(image) ? _.fixUrl(image, protocol, host) : null;
};

export const getDescription = ($, selector, settings) => {

    let description = null;

    if (!_.isNonEmptyString(selector)) {
        $(selector).each(function () {
            if (!_.isNonEmptyString(description))
                description = $(this).text();
        });
    }

    if (!_.isNonEmptyString(description)) {
        description = getValueBySelector($, 'head>description');
    }

    if (!_.isNonEmptyString(description)) {
        description = getValueBySelector($, 'head>meta[name="description"]', 'content');
    }

    if (!_.isNonEmptyString(description)) {
        description = getValueBySelector($, 'head>meta[property="description"]', 'content');
    }

    if (!_.isNonEmptyString(description)) {
        description = getValueBySelector($, 'head>meta[property="og:description"]', 'content');
    }

    if (!_.isNonEmptyString(description)) {
        description = getValueBySelector($, 'head>meta[property="og:description"]', 'content');
    }

    if (!_.isNonEmptyString(description)) {
        description = getValueBySelector($, 'head>meta[property="twitter:description"]', 'content');
    }

    return _.isNonEmptyString(description)? cleanHTML(description, { ...settings.cleanHTML, returnContent: 'text' }):'';
};

export const getSummary = (content, settings) => {

    if (!_.isObject(settings)) settings = {};
    let result = cleanHTML(content, { ...settings.cleanHTML, returnContent: 'text' });

    //TODO: Use cheerio to handle html to text, _.removeAllAttributes 
    // result = htmlToText.fromString(result, {
    //     ignoreHref: true,
    //     ignoreImage: true
    // });

    const minLineWordsCount = _.isNumber(settings.minLineWordsCount) ? settings.minLineWordsCount : 10;

    result = _.without(_.map(result.split('.'), (s) => {
        if (s.split(' ').length < minLineWordsCount) return null;
        return `${s.trim()}. `;
    }), null).join('');

    return summarize(result, {
        extractAmount: _.isNumber(settings.maxLines) ? settings.maxLines : 3,
        summaryType: settings.maxLines == 'text' ? 'text' : 'array'
    });
};

// function web() {

//     process = async (cx, content, urlInfo, settings) => {

//         let result = {};
//         if (!_.isObject(settings)) settings = {};
//         const html = init(cx, content, urlInfo, settings.init);

//         const rawHtml = cheerio.load(content);
//         const language = settings.metadata && _.isNonEmptyString(settings.metadata.language) ? settings.metadata.language : 'en';

//         if (settings.raw) result.raw = html.html();

//         //console.log(content);

//         result = getMetadata(cx, html, result, urlInfo, settings.metadata);

//         if (settings.includeRawContent) result.content = content;

//         //get lang
//         rawHtml('html').each(function () {
//             if (!_.isNonEmptyString(result.language)) {
//                 const lang = rawHtml(this).attr('lang');
//                 if (_.isNonEmptyString(lang)) {
//                     result.language = lang.split('-')[0].toLowerCase();
//                 }
//             }
//         });

//         if (!_.isNonEmptyString(result.language)) {
//             result.language = language;
//         }

//         //get article
//         result.article = _.getArticle(rawHtml, settings && settings.article && settings.article.selector);
//         if (_.isNonEmptyString(result.article)) {
//             result.article = _.cleanHTML(result.article,
//                 _.assign({
//                     urlInfo,
//                     removeHTMLBODY: true,
//                     keepSingleParent: true
//                 },
//                     settings.init && settings.init.cleanHTML));
//         }

//         result.price = _.getPrice(rawHtml, settings && settings.price && settings.price.selector);

//         result.currency = _.getCurrency(rawHtml);

//         //get gender info
//         rawHtml('meta[property="product:gender"]').each(function () {
//             if (!_.isNonEmptyString(result.gender)) {
//                 result.gender = rawHtml(this).attr('content');
//             }
//         });

//         //get color info
//         result.colors = [];
//         rawHtml('meta[property="product:color"]').each(function () {
//             if (_.isNonEmptyString(rawHtml(this).attr('content'))) {
//                 result.colors = _.concat(result.colors, rawHtml(this).attr('content').split('/'));
//             }
//         });
//         result.colors = _.uniq(_.map(result.colors, (color) => {
//             return color.toLowerCase();
//         }));

//         if (settings.image && _.isNonEmptyString(settings.image.selector)) {
//             let imageSrc = null;
//             let imageSrcSet = null
//             console.log({imageSelector: settings.image.selector})
//             rawHtml(settings.image.selector).each(function () {
//                 if (!_.isNonEmptyString(imageSrc)) {
//                     imageSrcSet = rawHtml(this).attr('srcset');
//                     imageSrc = rawHtml(this).attr('src');

//                     console.log({imageSrcSet, imageSrc})

//                     if (_.isNonEmptyString(imageSrcSet)) {
//                         const imageSrcSetList = imageSrcSet.split('\n');
//                         imageSrc = imageSrcSetList[imageSrcSetList.length - 1].trim().split(' ');
//                         imageSrc = imageSrc[0].trim();
//                         imageSrcSet = _.map(imageSrcSetList, (l) => fixUrl(l.trim(), urlInfo.protocol, urlInfo.host)).join('\n');
//                     }

//                     if (_.isNonEmptyString(imageSrc)) {
//                         imageSrc = fixUrl(imageSrc, urlInfo.protocol, urlInfo.host);
//                     }
//                 }
//             });
//             if (_.isNonEmptyString(imageSrc)) result.image = imageSrc;
//             if (_.isNonEmptyString(imageSrcSet)) result.imageSet = imageSrcSet;
//         }

//         if (!_.isNonEmptyString(result.article)) {
//             result.article = findMainContentElement(html, html('body')).html();
//         }
//         //result = getArticle(cx, html, result, settings.article);
//         result.summary = getSummary(cx, _.isNonEmptyString(result.article) ? result.article : description, settings.summary);

//         //Process Tags
//         let tagFeed = _.htmlToText(`<div>${result.title}</div><div>${description}</div><div>${result.article}</div>`, { bodyOnly: true });
//         try {
//             result.tags = await getKeyPhrases(cx, tagFeed, settings && settings.tags);
//         }
//         catch (exTags1) {
//             console.error(exTags1)
//             if (exTags1.code == 'TextSizeLimitExceededException') {
//                 try {
//                     tagFeed = _.htmlToText(`<div>${result.title}</div><div>${description}</div>`, { bodyOnly: true });
//                     result.tags = await getKeyPhrases(cx, tagFeed, settings && settings.tags);
//                 }
//                 catch (exTags2) {
//                     console.error(exTags2)
//                 }
//             }
//         }

//         return result;
//     }

//     init = (cx, content, urlInfo, settings) => {
//         if (!_.isObject(settings)) settings = {};
//         return _.cleanHTML(content, _.assign({
//             urlInfo,
//             keepSingleParent: true
//         }, settings.cleanHTML), true);
//     }


//     getMetadata = (cx, html, result, urlInfo, settings) => {

//         if (!html) return result;
//         if (!_.isObject(settings)) settings = {};
//         if (!_.isObject(result)) result = {};
//         result = getTitle(cx, html, result);
//         result = getImage(cx, html, result);
//         result = getUrl(cx, html, result);
//         result = getIcon(cx, html, result, urlInfo);
//         result = getCanonical(cx, html, result, urlInfo);


//         return result;
//     }

export const getKeyPhrases = async (content, settings) => {

    if (!_.isObject(settings)) settings = {};
    settings = _.assignDeep(solution.webProcessSettings.tags, settings);

    const useCloudService = settings.service == 'google' || settings.service == 'aws';
    if (!useCloudService) settings.maxContentLength = 1000 * 10;

    if (_.isNumber(settings.maxContentLength) && settings.maxContentLength < 980) settings.maxContentLength = 980;
    if (_.isNumber(settings.maxContentLength)) {
        content = content.length > settings.maxContentLength ? content.substring(0, settings.maxContentLength) : content;
    }
    settings.maxWordsCountPerPhrase = _.isNumber(settings.maxWordsCountPerPhrase) ? settings.maxWordsCountPerPhrase : 5;

    let result = [];

    switch (settings.service) {
        case 'google':
            {
                result = await getKeyPhrasesByUsingGoogle(content, settings);
                break;
            }
        case 'aws':
            {
                result = await getKeyPhrasesByUsingAWS(content, settings);
                break;
            }
        default:
            {
                result = await getKeyPhrasesByUsingPlatform(content, settings);
                break;
            }
    }

    let tags = [];

    _.each(result, (tag) => {
        const s = _.isObject(tag) ? tag.text.split(',') : tag.split(',');
        tags = _.union(tags, s);
    });

    return processTags(tags, settings);
};

export const getKeyPhrasesByUsingGoogle = async (content, settings) => {

    if (!_.isObject(settings)) settings = {};
    if (!_.isNonEmptyString(content)) return [];

    settings.minScore = _.isNumber(settings.minScore) ? settings.minScore : 0;

    const options = {
        method: 'post',
        url: `https://language.googleapis.com/v1/documents:analyzeEntities`,
        headers: {
            'X-Goog-Api-Key': await _.getSecretValue('GOOGLE_API_KEY'),
            'Content-Type': 'application/json'
        },
        data: { document: { content, type: 'PLAIN_TEXT' } }
    };

    const result = (await axios.request(options)).data.entities;
    if (_.trackLibs) console.log({ result: JSON.stringify(result) });

    return processTags(_.without(_.map(result, (w) => {
        if (settings.removeNumber && w.type == 'NUMBER') return null;
        if (settings.removeDate && w.type == 'DATE') return null;
        return { score: w.salience, text: w.name, type: w.type };
    }), null), settings);
};

export const getKeyPhrasesByUsingPlatform = async (content, settings) => {

    if (!_.isObject(settings)) settings = {};
    if (!_.isNonEmptyString(content)) return [];

    const solutionId = solution.id;

    const entityName = _.isNonEmptyString(settings.entityName) ? settings.entityName : null;
    const entityType = _.isNonEmptyString(entityName) && _.isNonEmptyString(settings.entityType) ? settings.entityType : null;
    const cacheExpireMinutes = _.isNonEmptyString(settings.cacheExpireMinutes) ? settings.cacheExpireMinutes : 60;
    const skipColorsTagGroup = _.isBoolean(settings.skipColorsTagGroup) ? settings.skipColorsTagGroup : false;
    const skipBizNamesTagGroup = _.isBoolean(settings.skipBizNamesTagGroup) ? settings.skipBizNamesTagGroup : false;
    const skipEntityTagGroup = _.isBoolean(settings.skipEntityTagGroup) ? settings.skipEntityTagGroup : false;


    let tagsBase = _.getMemoryCache(`tags-base`);
    let tagsColors = _.getMemoryCache(`tags-colors`);
    let tagsNames = _.getMemoryCache(`tags-names`);

    let key = null;

    //base tags
    if (!tagsBase) {
        try {
            key = `${solutionId}/Platform/tags-base.json`;
            tagsBase = JSON.parse((await _.s3.getObject({
                Bucket: `${process.env.RESOURCE_PREFIX}-data`,
                Key: key,
            }).promise()).Body.toString());
            _.setMemoryCache(`tags-base`, tagsBase, cacheExpireMinutes);
        }
        catch (ex) {
            console.error(ex, key);
        }
    }
    else {
        console.log('get base tags from cache.');
    }

    //colors tags
    if (!tagsColors && !skipColorsTagGroup) {
        try {
            key = `${solutionId}/Platform/tags-colors.json`;
            tagsColors = JSON.parse((await _.s3.getObject({
                Bucket: `${process.env.RESOURCE_PREFIX}-data`,
                Key: key,
            }).promise()).Body.toString());
            _.setMemoryCache(`tags-colors`, tagsColors, cacheExpireMinutes);
        }
        catch (ex) {
            console.error(ex, key);
        }
    }
    else {
        if (tagsColors) console.log('get colors tag group from cache.');
    }

    if (!tagsNames && !skipBizNamesTagGroup) {
        //names tags
        try {
            key = `${solutionId}/Platform/tags-names.json`;
            tagsNames = JSON.parse((await _.s3.getObject({
                Bucket: `${process.env.RESOURCE_PREFIX}-data`,
                Key: key,
            }).promise()).Body.toString());
            _.setMemoryCache(`tags-names`, tagsNames, cacheExpireMinutes);
        }
        catch (ex) {
            console.error(ex, key);
        }
    }
    else {
        if (tagsNames) console.log('get names tag group from cache.');
    }

    let tagsEntity = [];
    if (_.isNonEmptyString(entityName)) {
        tagsEntity = _.getMemoryCache(`tags-entity-${entityName}-${entityType}`);

        //entity level tags
        if (!tagsEntity && !skipEntityTagGroup) {
            try {
                key = `${solutionId}/Platform/tags-${entityName.toLowerCase()}${_.isNonEmptyString(entityType) ? '.' + entityType.toLowerCase() : ''}.json`;
                tagsEntity = JSON.parse((await _.s3.getObject({
                    Bucket: `${process.env.RESOURCE_PREFIX}-data`,
                    Key: key,
                }).promise()).Body.toString());
                _.setMemoryCache(`tags-entity-${entityName}-${entityType}`, tagsEntity, cacheExpireMinutes);
            }
            catch (ex) {
                console.error(ex, key);
            }
        }
        else {
            if (tagsEntity) console.log('get entity tag group from cache.');
        }
    }

    const tags = _.union(
        tagsBase,
        tagsColors,
        tagsNames,
        tagsEntity);

    return getKeyPhrasesByUsingTagGroup(content, tags, settings);
};

export const getKeyPhrasesByUsingTagGroup = (content, tags, settings) => {
    //convert the tags to take care of plural
    let tagList = extendTags(tags);
    //tagList = processTags(tagList, settings);
    content = ` ${content.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, ' ')
        .replace(/&nbsp;/g, " ")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\t/g, " ")
        .replace(new RegExp(`( ){2,}`, "g"), " ")
        .trim()} `;
    // const result = [];
    // const start = Date.now();
    // _.each(tagList, (tag) => {
    //     const r = eval(`/ ${tag} /gi`);
    //     const f = content.match(r );
    //     if (f) {
    //         content = content.replace(r, ' ');
    //         result.push({ score: f.length, text: tag });
    //         console.log(content);
    //     }
    // })
    // console.log(content);
    // console.log(tagList);
    // console.log(` ${tagList.join(' | ')} `);

    const result = _.map(content.match(new RegExp(` ${tagList.join(' | ')} `, 'gi')), (tag) => {
        return tag.trim();
    });

    return processTags(result, settings);
};

export const getKeyPhrasesByUsingAWS = async (content, settings) => {

    if (!_.isObject(settings)) settings = {};
    if (!_.isNonEmptyString(content)) return [];

    settings.minScore = _.isNumber(settings.minScore) ? settings.minScore : 0.5;

    //There's 5000 chars limit
    return new Promise((resolve, reject) => {
        comprehend.detectKeyPhrases({
            LanguageCode: settings.languageCode ? settings.languageCode : 'en', /* required */
            Text: content.length > 4800 ? content.substring(0, 4800) : content /* required */
        }, function (err, data) {
            if (err) {
                reject(err, err.stack);
            }
            else {

                resolve(processTags(
                    _.map(data.KeyPhrases, (w) => {
                        return { score: w.Score, text: w.Text };
                    }),
                    settings));
            }

        });
    });
};