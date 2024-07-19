import { Client as ElasticClient } from "elasticsearch";
const debug = require('debug')('authentication-flows:elasticsearch-repository');

export abstract class EsBaseRepository<T> {

    protected _elasticClient: ElasticClient;

    protected abstract getIndex(): string;

    protected constructor() {
        let nodeAgent;

        this._elasticClient = new ElasticClient({
            host: process.env.ELASTIC_SEARCH_URL,
            httpAuth: process.env.ELASTIC_AUTH,
            //log: 'trace',  <= lets reduce the printouts, default is warning
            apiVersion: '7.2', // use the same version of your Elasticsearch instance
            createNodeAgent: nodeAgent
        });
    }

    /**
     * used for REPLACE. UPDATE does not delete fields from the doc, it only updates the given fields.
     */
    public async indexItem(id: string, body: T, index: string = null): Promise<string> {
        let response;

        if(!index)
            index = this.getIndex();

        debug(`indexing ${id} into ${index}...`);

        try {
            response = await this._elasticClient.index({
                index,
                id,
                body: body
            });
        } catch (error) {
            debug(error);
            return Promise.reject(error);
        }
        debug(`index response: ${JSON.stringify(response)}`);
        return Promise.resolve(response.result);
    }

    public async getItem(id: string): Promise<T> {
        if (!id) {
            return Promise.reject(new Error('getItem() Invalid Args: id is null'));
        }

        let item;

        try {
            const response = await this._elasticClient.get({
                index: this.getIndex(),
                id,
                ignore: 404
            });
            item = response?._source;
        } catch (error) {
            debug(error);
            return Promise.reject(error);
        }

        if(item)
            debug(`getItem/${this.getIndex()}: Successfully retrieved item '${id}'`);
        else
            debug(`getItem/${this.getIndex()}: item was Not Found '${id}'`);

        return Promise.resolve(item);
    }

    public async exists(id: string): Promise<boolean> {
        let response;
        try {
            response = await this._elasticClient.exists({
                index: this.getIndex(),
                id
            });
        } catch (error) {
            return Promise.reject(error);
        }
        return Promise.resolve(response);
    }

    /**
     * used for UPDATE. it only updates the given fields in body.
     */
    public async updateItem(id: string, body: object) {
        let response;
        try {
            response = await this._elasticClient.update({
                index: this.getIndex(),
                id,
                body: {
                    // put the partial document under the `doc` key
                    doc: body
                }
            });

        } catch (error) {
            debug(error);
            return Promise.reject(error);
        }
        return Promise.resolve(response.result);
    }

    public async deleteItem(id: string): Promise<string> {
        let response;
        debug('deleting: ', id);

        try {
            response = await this._elasticClient.delete({
                index: this.getIndex(),
                id
            });
        } catch (error) {
            debug(error);
            return Promise.reject(error);
        }
        debug('response', response);
        return Promise.resolve(response.result);    //result should be 'updated'
    }

    public async search(query: object): Promise<T[]> {
        if (!query) {
            return Promise.reject(new Error('search() Invalid Args: query is null'));
        }

        debug(`search(): Retrieving for query: '${JSON.stringify(query)}'`);
        let items;     //hits from elastic

        try {
            const response = await this._elasticClient.search({
                index: this.getIndex(),
                size: 5000,
                body: query
            });
            items = response?.hits?.hits;
        } catch (error) {
            return Promise.reject(error);
        }

        items = items.map(item => item._source);

        debug(`search(): Successfully retrieved ${items.length} items for query`);
        return Promise.resolve(items);
    }


    /**
     * get all items, using scroll
     */
    public async getAllItems(): Promise<T[]> {
        const allQuotes: T[] = [];

        // start things off by searching, setting a scroll timeout, and pushing
        // our first response into the queue to be processed
        let response = await this._elasticClient.search({
            index: this.getIndex(),
            // keep the search results "scrollable" for 30 seconds
            scroll: '30s',
            size: 1000,
            // filter the source to only include the quote field
//            _source: ['quote'],
            body: {
                query: {
                    match_all: {}
                }
            }
        });


        while (true) {

            debug('getAllItems() found ' + response.hits.hits.length);
            if(response.hits.hits.length == 0) {
                break;
            }

            // collect the titles from this response
            response.hits.hits.forEach(function (hit) {
                //debug(hit._id);
                allQuotes.push(hit._source)
            });

            // get the next response if there are more quotes to fetch
            response = await this._elasticClient.scroll({
                scrollId: response._scroll_id,
                scroll: '30s'
            });
        }

        return Promise.resolve(allQuotes);
    }
}