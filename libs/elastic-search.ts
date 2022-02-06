//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { getSecretValue} from './secret-manager';
import { isObject, _process } from 'douhub-helper-util';
import { Client as SearchClient } from "@elastic/elasticsearch";

export const getElasticSearch = async () => {

    if (isObject(_process._elasticSearch)) return _process._elasticSearch;
    const secrets = await getSecretValue('ELASTIC_SEARCH');
    const elasticSearchSecret = secrets.split("|");
     
    try {
        _process._elasticSearch = new SearchClient({
            node: elasticSearchSecret[0],
            auth: {
                username: elasticSearchSecret[1],
                password: elasticSearchSecret[2],
            },
        });
    }
    catch (error) {
        console.error({ error, message: 'Failed to new SearchClient' });
    }

    return _process._elasticSearch;
};

export const elasticSearchQuery = async (query: Record<string,any>): Promise<Record<string, any>> => {
    return (await (await getElasticSearch()).search(query)).body;
};

export const  elasticSearchDelete = async (index: string, id: string) => {
    await (await getElasticSearch()).delete({ index, id });
};

export const  elasticSearchUpsert = async (index: string, data: Record<string,any>) => {
    await (await getElasticSearch()).index({ index, id: data.id, body: data });
};