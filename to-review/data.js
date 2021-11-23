//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2018 All Right Reserved
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
import {getDisplay} from '../../shared/util/data';

// import cheerio from 'cheerio';
// import csvtojson from 'csvtojson';

// export const removeProcessContentCacheValue = (key) => {
//     if (!_.global.CONTENT_CACHE || !_.isNonEmptyString(key)) return;
//     for (var prop in _.global.CONTENT_CACHE) {
//         if (prop.indexOf(key) >= 0) delete _.global.CONTENT_CACHE[prop];
//     }
// }

// export const setProcessContentCacheValue = (key, ts, c) => {

//     if (!_.global || !_.isNonEmptyString(key)) return;
//     if (!_.isObject(_.global.CONTENT_CACHE)) _.global.CONTENT_CACHE = {};
//     _.global.CONTENT_CACHE[key] = { ts, c };
// }


// export const getProcessContentCacheValue = (key, ts) => {

//     if (!_.global.CONTENT_CACHE || !_.isNonEmptyString(key)) return null;

//     const val = _.global.CONTENT_CACHE[key];
//     if (!val) {
//         console.log('getProcessContentCacheValue !val');
//         return null;
//     }

//     if (val.ts != ts) {
//         console.log('getProcessContentCacheValue val.ts != ts');
//         return null;
//     }

//     return val.c;
// }

// export const processUploadData = async (entity, fields, content) => {

//     if (!_.isNonEmptyString(fields) || _.isNonEmptyString(fields) && fields.indexOf('h.') != 0) {
//         return {
//             errorCode: 'BAD_HEADER', message: `
//             Please make sure you put the correct header in the csv file. 
//             The header need to be in the format of <br/>h.{fieldName1},h.{fieldName2},h.{fieldName3} ... <br/>(Form example: h.firstName,h.lastName, ...)
//         `};
//     }

//     const fieldDelimiter = fields.indexOf('\t') > 0 ? '\t' : ',';
//     const fieldList = fields.split(fieldDelimiter);

//     let fieldNameStartWithH = true;
//     for (var i = 0; i < fieldList.length && fieldNameStartWithH; i++) {
//         const fieldInfo = fieldList[i].split('.');
//         if (fieldInfo.length != 2 || fieldInfo[0].trim() != 'h') {
//             fieldNameStartWithH = true;
//         }
//         else {
//             fieldList[i] = fieldInfo[1].trim();
//         }
//     }

//     if (!fieldNameStartWithH) {
//         return {
//             errorCode: 'BAD_HEADER', message: `
//             Please make sure the field name in the header with a 'h.' as the prefix.
//             <br/>(Form example: h.firstName,h.lastName, ...)
//         `};
//     }

//     if (entity.upload && _.isArray(entity.upload.supported)) {

//         let unSupportedFields = [];

//         _.each(fieldList, (field) => {
//             if (!_.find(entity.upload.supported, (uploadField) => uploadField.name.trim() == field.trim())) unSupportedFields.push(field);
//         })

//         if (unSupportedFields.length > 0) {
//             return {
//                 errorCode: 'BAD_HEADER', message: `The fields below are not supported by upload 
//             <br/><i style="color:red">${unSupportedFields.join(',')}</i>
//             <br/><br/>Please use the fields in the list below <br/><i style="color:green">${_.map(entity.upload.supported, (uploadField) => uploadField.name).join(',')}</i>`
//             };
//         }
//     }


//     if (!_.isNonEmptyString(content)) {
//         return { errorCode: 'BAD_CONTENT', message: `Please provide content to upload.` }
//     }

//     const rows = _.without(_.map(content.split('\n'), (row) => row.trim().length == 0 ? null : row), null);

//     const result = {
//         oriHeader: fields,
//         newHeader: fieldList.join(fieldDelimiter),
//         fieldDelimiter,
//         content: rows.join('\n'),
//         entityName: entity.entityName
//     };

//     if (_.isNonEmptyString(entity.entityType)) result.entityType = entity.entityType;

//     const csvJson = await csvtojson().fromString(`${result.newHeader}\n${result.content}`);
//     if (_.trackLibs) console.log({ csvJson, rows });

//     //check column count
//     const rowColumnCountWrong = _.find(csvJson, (item) => {
//         //console.log({a1:Object.keys(item).length , a2:fieldList.length});
//         return Object.keys(item).length != fieldList.length;
//     });

//     if (rowColumnCountWrong) {
//         return { errorCode: 'BAD_CONTENT_ROW', message: `The count of fields defined in the header does not match the count of values in the row.` };
//     }

//     //check required field
//     if (entity.upload && _.isArray(entity.upload.required)) {
//         const missingRequiredField = _.find(
//             _.map(entity.upload.required, (f) => f.trim()),
//             (reqFieldName) => {
//                 return _.find(csvJson, (row) => {
//                     ////we can define a "or" requirement. e.g. a project has to have a "name" or "number", it will be defined as "name|number"
//                     const requires = reqFieldName.split('|');
//                     return _.find(requires, (require) => {
//                         return !_.isNull(row[require]) && !_.isNil(row[require]) && `${row[require]}`.length > 0;
//                     }) ? false : true;
//                 });
//             })

//         if (missingRequiredField) {
//             return { errorCode: 'BAD_CONTENT_ROW', message: `There is a row missing required value (${entity.upload.required.join(',')}) ` };
//         }
//     }

//     return result;
// }

// export function processContent(context, c, record, user, options) {

//     const userProfile = context.user;
//     const organization = context.organization;
//     const solution = context.solution;

//     if (!_.isObject(options)) options = {};


//     const tsKey = `${solution && solution['_ts']}_${organization && organization['_ts']}_${userProfile && userProfile['_ts']}_${record && record['_ts']}_${user && user['_ts']}_${record && record.highlight ? true : false}`;
//     const cacheKey = `${options.cacheKey}-${userProfile && userProfile.id}-${user && user.id}-${record && record.id}-${options.props}`;
//     const processContentCacheValue = options.cache === false ? null : getProcessContentCacheValue(cacheKey, tsKey);

//     if (processContentCacheValue) return processContentCacheValue;

//     if (_.isNonEmptyString(options.props)) {
//         if (`,${options.props},`.indexOf(',id,') < 0) options.props = `${options.props},id`;
//         if (`,${options.props},`.indexOf(',highlight,') < 0) options.props = `${options.props},highlight`;
//         if (`,${options.props},`.indexOf(',temp,') < 0) options.props = `${options.props},temp`;

//         if (`,${options.props},`.indexOf(',display,') >= 0) {
//             if (`,${options.props},`.indexOf(',displayValue,') < 0) options.props = `${options.props},displayValue`;
//             if (`,${options.props},`.indexOf(',title,') < 0) options.props = `${options.props},title`;
//             if (`,${options.props},`.indexOf(',name,') < 0) options.props = `${options.props},name`;
//             if (`,${options.props},`.indexOf(',text,') < 0) options.props = `${options.props},text`;
//             if (`,${options.props},`.indexOf(',symbol,') < 0) options.props = `${options.props},symbol`;
//             if (`,${options.props},`.indexOf(',code,') < 0) options.props = `${options.props},code`;
//         }

//         if (`,${options.props},`.indexOf(',abstract,') >= 0) {
//             if (`,${options.props},`.indexOf(',summary,') < 0) options.props = `${options.props},summary`;
//             if (`,${options.props},`.indexOf(',description,') < 0) options.props = `${options.props},description`;
//             if (`,${options.props},`.indexOf(',content,') < 0) options.props = `${options.props},content`;
//         }

//         record = _.getSubObject(record, options.props);
//     }

//     c = c.replace(/\[PH[.]DEFAULT_PHOTO_URL\]/g, solution.default.photo);
//     c = c.replace(/\[PH[.]DEFAULT_USER_PHOTO_URL\]/g, solution.default.userPhoto);
//     c = c.replace(/\[PH[.]DEFAULT_ORG_PHOTO_URL\]/g, solution.default.orgPhoto);

//     const logoIcon = getSitePropValue(context, 'logoIcon');

//     c = c.replace(/\[PH[.]LOGO_ICON_152x152\]/g, logoIcon.replace('{width}', '152').replace('{height}', '152'));
//     c = c.replace(/\[PH[.]LOGO_ICON_120x120\]/g, logoIcon.replace('{width}', '120').replace('{height}', '120'));
//     c = c.replace(/\[PH[.]LOGO_ICON_76x76\]/g, logoIcon.replace('{width}', '76').replace('{height}', '76'));
//     c = c.replace(/\[PH[.]LOGO_ICON_60x60\]/g, logoIcon.replace('{width}', '60').replace('{height}', '60'));

//     c = mergeContentWithRecords(context, c, {
//         ph: record,
//         user: userProfile,
//         organization,
//         solution
//     }, _.isObject(user) ? user : userProfile, options)

//     //c = processAction_Hx(c);
//     c = processAction_Imgs(c);
//     c = processAction_Medias(c);

//     //Processing to images have to be called first above
//     c = processAction_IFrames(c, record);
//     //c = processAction_Abstract(c);
//     c = processAnchors(c);

//     c = processAction_RemoveElems(c);

//     if (options.cache !== false) setProcessContentCacheValue(cacheKey, tsKey, c);

//     return c;

// }


// // export function processAction_Hx(c) {
// //     const $ = cheerio.load(c);
// //     $('h1,h2,h3,h4,h5,h6,h7').each(function () {
// //         const hSize = parseInt($(this).get(0).tagName.replace('H', '').replace('h', ''));
// //         const newH = hSize >= 5 ? 'p' : `h${hSize + 1}`;
// //         $(this).replaceWith(`<${newH}>` + $(this).html() + `</${newH}>`);
// //     });
// //     return $('body').html();
// // }

// export function processAction_Imgs(c) {
//     const $ = cheerio.load(c);
//     $('img[data-src]').each(function () {
//         const src = $(this).attr('data-src');
//         if (!_.isNonEmptyString(src)) {
//             const defaultUrl = $(this).attr('data-default');

//             if (!_.isNonEmptyString(defaultUrl)) {
//                 $(this).remove();
//             }
//             else {
//                 $(this).attr('src', defaultUrl).removeAttr('data-default').removeAttr('data-src');
//             }
//         }
//         else {
//             let src = $(this).attr('data-src');

//             src = processPhotoLink(src, $(this).attr('data-photo-size'));

//             $(this).attr('src', src).removeAttr('data-src').removeAttr('data-photo-size');
//         }

//     })
//     return $('body').html();
// }

// function processPhotoLink(src, photoSize) {

//     if (_.isNonEmptyString(photoSize) && src.indexOf('retrieve/photo.') > 0) {
//         src = _.map(src.split('/'), (s) => {
//             if (s.indexOf('photo.') == 0) s = `${s}.${photoSize}`;
//             return s;
//         }).join('/');
//     }

//     return src;
// }

// export function processAction_Medias(c) {
//     const $ = cheerio.load(c);
//     $('.douhub-action-showmedia').each(function () {
//         if ($(this).find('iframe,img').length == 0) {
//             const defaultSrc = $(this).attr('data-default');
//             let src = $(this).attr('data-src');
//             src = _.isNonEmptyString(src) ? src : defaultSrc;

//             if (_.isNonEmptyString(src)) {

//                 let handled = false;

//                 if (src.indexOf('/video-player/') > 0) {
//                     handled = true;
//                     //75%: 4:3, 66.66% 3:2, 56.25% 16:9
//                     $(this).addClass("douhub-media-padding-top-adj-16x9").css('position', 'relative');
//                     $(this).append(`<iframe class="douhub-iframe-video" src="${src}" frameborder="0" scrolling="no" style="border:none; width:100%; height:100%; position:absolute; top:0; left:0"/>`);
//                 }

//                 if (src.indexOf('.youtube.') > 0 || src.indexOf('/youtu.be/') > 0 || src.indexOf('/youtube.') > 0) {
//                     handled = true;
//                     //75%: 4:3, 66.66% 3:2, 56.25% 16:9
//                     $(this).addClass("douhub-media-padding-top-adj-16x9").css('position', 'relative');
//                     src = _.getYouTubeUrl(src);
//                     $(this).append(`<iframe class="douhub-iframe-video" src="${src}" 
//                     frameborder="0" scrolling="no" style="border:none; width:100%; height:100%; position:absolute; top:0; left:0"/>`);
//                 }

//                 if (!handled) {
//                     src = processPhotoLink(src, $(this).attr('data-photo-size'));
//                     //console.log(src)
//                     $(this).append(`<img src="${src}" style="max-width:100%; max-height:100%"/>`);
//                 }
//             }
//         }
//         else {
//             const videoIframe = $(this).find('.douhub-iframe-video');
//             if (videoIframe.length > 0) {
//                 $(this).addClass("douhub-media-padding-top-adj-16x9").css('position', 'relative');
//                 //videoIframe.width($(this).width()).height($(this).width() * 9 / 16);
//                 videoIframe.attr('frameborder', '0');
//                 videoIframe.attr('scrolling', 'no');
//                 videoIframe.css("border:none; width:100%; height:100%; position:absolute; top:0; left:0");
//             }

//         }
//     })

//     return $('body').html();
// }


// export function processAction_RemoveElems(c) {
//     const $ = cheerio.load(c);
//     $('.douhub-remove-true-true,.douhub-remove-true').remove();
//     return $('body').html();
// }

// export function processAnchors(c) {
//     const $ = cheerio.load(c);
//     $('a').each(function () {
//         $(this).attr('target', '_blank');
//     })

//     return $('body').html();
// }


// export function processAction_IFrames(c, r) {
//     const $ = cheerio.load(c);
//     let i = 0;
//     $('.douhub-action-iframe').each(function () {
//         i++;

//         let iframeId = $(this).attr('id');
//         if (!iframeId) {
//             iframeId = `douhub_action_iframe_${_.isObject(r) ? r.id : ''}_${i}`;
//             $(this).attr('id', iframeId);
//         }

//         let src = $(this).attr('src');
//         if (!_.isNonEmptyString(src)) src = $(this).attr('data-src');

//         src = setWebQueryValue(src, 'iframeId', iframeId);

//         if (_.isNonEmptyString(src)) {
//             if ($(this)[0].hasAttribute('data-cloud-name')) {
//                 const cloudName = $(this).attr('data-cloud-name').split('.');
//                 switch (cloudName[cloudName.length - 1].toLowerCase().trim()) {

//                     case 'pdf':
//                     case 'txt':
//                     case 'csv':
//                     case 'xml':
//                         {
//                             src = `https://docs.google.com/gview?embedded=true&url=${src}`;
//                             break;
//                         }
//                     case 'doc':
//                     case 'docx':
//                     case 'xls':
//                     case 'xlsx':
//                         {
//                             src = `https://view.officeapps.live.com/op/embed.aspx?src=${src}`;
//                             break;
//                         }
//                     default:
//                         {
//                             break;
//                         }
//                 }

//                 $(this).removeAttr('data-cloud-name');
//             }

//             $(this).attr('src', src).attr("frameborder", 0).attr("scrolling", "no").css("border", "none").removeAttr('data-src');
//         }
//     })

//     return $('body').html();
// }

// // export function processAction_Abstract(c) {

// //     const $ = cheerio.load(c);

// //      $('.douhub-action-abstract').each(function () {

// //         const abstract = $(this);
// //         const content = abstract.text();
// //         const maxLen = !isNaN(parseInt(abstract.attr("data-max"))) ? parseInt(abstract.attr("data-max")) : 64;

// //         //if the abstract contains .douhub-highlight, we will do nothing and return 
// //         if (!(abstract.find(".douhub-highlight").length > 0 || content.length < maxLen))
// //         {
// //             abstract.html(`<span class="douhub-action-abstract-ori" style="display:none">${content}</span><span class="douhub-action-abstract-cur">${content.substring(0, maxLen) + ' ...'}</span><span class="ficon ft-chevron-down douhub-action-abstract-icon"></span>`);
// //         }
// //     });

// //     return $('body').html();
// // }

// export function prepareUpdateTreeViewData(record, entityName, entityType, data, propName) {
//     if (!_.isArray(record[propName])) record[propName] = [];
//     let exist = false;
//     record[propName] = _.map(record[propName], (c) => {
//         if (entityName === c.entityName && (!_.isNonEmptyString(entityType) || entityType === c.entityType)) {
//             exist = true;
//             c.data = data;
//         }

//         return c;
//     });

//     if (!exist) {
//         record[propName].push({ entityName, entityType, data });
//     }

//     return record;
// }

export const applySlug = (record) => {
    const id = record.id;
    const display = getDisplay(record);
    if (!_.isArray(record.slugs)) record.slugs = [];
    const curSlug = _.slug(`${display} ${id.split('-')[1]}`);
    if (!_.find(record.slugs, (slug) => slug == curSlug)) {
        record.slugs.push(curSlug);
    }
    
    record.slug = curSlug;
    return record;
};

// export const newRecord = (context, entity, initData) => {
//     const user = context.user;
//     const data = {
//         id: _.newGuid(), entityName: entity.entityName,
//         ownedBy: user.id, createdBy: user.id,
//         modifiedBy: user.id, _sys: 'create'
//     };
//     if (entity.entityType) data.entityType = entity.entityType;

//     const utcNow = _.utcISOString();
//     data.createdOn = utcNow;
//     data.ownedOn = utcNow;
//     data.modifiedOn = utcNow;
//     data.owner_info = _.cloneDeep(user);

//     return _.assign({}, data, entity.newRecord, initData);
// }

// export const cloneRecord = (context, record) => {
//     const user = context.user;
//     const newRecord = { ...record };
//     newRecord['_sys'] = 'create';
//     newRecord.id = _.newGuid();
//     newRecord.cloneFrom = record.id;

//     delete newRecord['_rid'];
//     delete newRecord['_self'];
//     delete newRecord['_etag'];
//     delete newRecord['_attachments'];
//     delete newRecord['_ts'];
//     delete newRecord.isGlobalOrderBy;
//     delete newRecord.isGlobal;
//     delete newRecord.organizationId;
//     delete newRecord.solutionId;

//     newRecord.createBy = user.id;
//     newRecord.modifiedBy = user.id;
//     newRecord.ownedBy = user.id;

//     const utcNow = _.utcISOString();
//     newRecord.createdOn = utcNow;
//     newRecord.ownedOn = utcNow;
//     newRecord.modifiedOn = utcNow;
//     newRecord.owner_info = _.cloneDeep(user);

//     let cloneText = false;
//     if (!cloneText && _.isNonEmptyString(newRecord.displayValue)) { cloneText = true; newRecord.displayValue = `${newRecord.displayValue} - cloned`; }
//     if (!cloneText && _.isNonEmptyString(newRecord.title)) { cloneText = true; newRecord.title = `${newRecord.title} - cloned`; }
//     if (!cloneText && _.isNonEmptyString(newRecord.name)) { cloneText = true; newRecord.name = `${newRecord.name} - cloned`; }
//     if (!cloneText && _.isNonEmptyString(newRecord.text)) { cloneText = true; newRecord.text = `${newRecord.text} - cloned`; }

//     return newRecord;
// }


export const processTags = (tags, settings) => {
    if (!_.isObject(settings)) settings = {};

    const ignoreWords = extendTags(_.isString(settings.wordsToIgnore) ? _.without(_.map(settings.wordsToIgnore.split(','), word => {
        word = word.toLowerCase().trim();
        return word.length == 0 ? null : word;
    }), null) : []);

    const ignorePhrases = extendTags(_.isString(settings.phrasesToIgnore) ? _.without(_.map(settings.phrasesToIgnore.split(','), phrase => {
        phrase = phrase.toLowerCase().trim();
        return phrase.length == 0 ? null : phrase;
    }), null) : []);

    let phrases = _.without(_.map(tags, (tag) => {

        const score = _.isObject(tag) && tag.score;
        if (_.isNumber(score) && score < settings.minScore) return null;

        const text = (_.isObject(tag) ? tag.text : tag)
            .replace(/_/g, '-').replace(/[^a-zA-Z0-9\\-]+/g, ' ')
            .replace(new RegExp(`( ){2,}`, 'g'), ' ')
            .replace(new RegExp(/%/g, 'g'), '')
            .trim();

        const textArray = _.without(_.map(text.split(' '), (word) => {

            if (settings.removeNumberInWord && !_.isNaN(Number(word.trim()))) return null;
            if (_.find(ignoreWords, (w) => w == word.toLowerCase().trim())) return null;
            if (word.length <= 1) return null;
            return word;

        }), null);

        if (textArray.length > settings.maxWordsCountPerPhrase) return null;

        const phrase = textArray.join(' ').trim();

        if (phrase.length <= 1) return null;
        if (settings.removeNumber && !_.isNaN(Number(phrase))) return null;
        if (ignorePhrases.length > 0 && _.find(ignorePhrases, p => p == phrase.toLowerCase().trim())) return null;

        return _.isObject(tag) ? { score, text: phrase } : phrase;
    }), null);

    if (phrases.length == 0) return [];
    if (!_.isObject(phrases[0])) {
        phrases = _.map(phrases, (p) => { 
            return _.isNonEmptyString(p) ? { text: p, score: p.length } : null;
        });
    }

    phrases = _.orderBy(
        _.without(_.uniqBy(phrases, (p) => { 
            return p.text ? p.text.toLowerCase() : null;
        }), null), 'score', 'desc'
    );

    return phrases;
};

export const extendTags = (tags) => {
    const tagList = [];
    _.each(tags, (tag) => {

        if (_.endsWith(tag, 'x')
            || _.endsWith(tag, 's')
            || _.endsWith(tag, 'ch')
            || _.endsWith(tag, 'sh')) {
            tagList.push(`${tag}es`);
        }
        if (_.endsWith(tag, 'y')) tagList.push(`${tag.slice(0, -1)}ies`);
        if (_.endsWith(tag, 'ife')) tagList.push(`${tag.slice(0, -3)}ives`);

        if (_.endsWith(tag, 's')) tagList.push(tag.slice(0, -1));
        if (_.endsWith(tag, 'es')) tagList.push(tag.slice(0, -2));
        if (_.endsWith(tag, 'ies')) tagList.push(`${tag.slice(0, -3)}y`);
        if (_.endsWith(tag, 'ives')) tagList.push(`${tag.slice(0, -4)}ife`);

        tagList.push(tag);
    });
    return tagList;
};