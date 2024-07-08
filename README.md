# authentication-flows-js-elasticsearch

[![npm Package](https://img.shields.io/npm/v/authentication-flows-js-elasticsearch.svg?style=flat-square)](https://www.npmjs.org/package/authentication-flows-js-elasticsearch)

This project is a **ElasticSearch implementation** for `AuthenticationAccountRepository` of 
[authentication-flows-js](https://github.com/OhadR/authentication-flows-js).


## environment variables

    ELASTIC_SEARCH_URL
    ELASTIC_AUTH: username:password

## preparations

download elasticsearch docker:

    docker pull docker.elastic.co/elasticsearch/elasticsearch:7.9.0

run elastic docker (version 7.1.0):

    docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:7.1.0
    
create mapping for AFM:

    PUT
    http://localhost:9200/authentication-account-22042021
    {
        "mappings": {
            "dynamic": "false",
            "properties": {
                "username": {
                    "type": "keyword"
                },
                "passwordLastChangeDate": {
                    "type": "date"
                }
                "token": {
                    "type": "keyword"
                }
                "tokenDate": {
                    "type": "date"
                }
            }
        }    
    }    

set environment variable:

    set ELASTIC_SEARCH_URL=https://localhost:9200