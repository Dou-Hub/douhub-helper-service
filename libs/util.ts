import { isNonEmptyString } from "douhub-helper-util";
import slugify from 'slugify';

export const slug = (text: string) => {
    return !isNonEmptyString(text) ? null : slugify(text.replace(/_/g, '-'), {
        lower: true,
        remove: /[=:?#@!$&'()*+,;"<>%{}|\\^`]/g
    })
        .replace(/\./g, '-')
        .replace(/\//g, '-')
        .toLowerCase();
};