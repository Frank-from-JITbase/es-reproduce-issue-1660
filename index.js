'use strict'

const { Client } = require('@elastic/elasticsearch')

const client = new Client({
  node: 'http://elastic:elastic@localhost:9200',
})

client.info(console.log)


const policyName = "my-policy"
const createPolicy = async ()=>{
  try {
    await client.ilm.getLifecycle({policy: policyName});
  } catch (error) {
    const bodyError = safeGet(error, 'body.error');
    const {type} = bodyError;
    if (type !== 'resource_not_found_exception') {
      console.error(bodyError);
      return;
    }
    // policy does not exist.  Create
    try {
      await client.ilm.putLifecycle({
        policy: policyName,
        body: {
          "policy": {
              "phases": {
                  "hot": {
                      "actions": {
                          "rollover": {
                              "max_size": "50mb",
                              "max_age": "6h"
                          },
                          "set_priority": {
                              "priority": 100
                          }
                      }
                  },
                  "delete": {
                      "min_age": "1d",
                      "actions": {
                          "delete": {}
                      }
                  }
              }
          }
      },
      });
    } catch (err2) {
      console.error(err2);
    }
  } finally {
    return policyName;
  }
}

const createTemplate = async ()=>{
  const templateName = `${policyName}-template`;
  let indexTemplateExists;

  try {
    const indexTemplateExistsRes = await client.indices.existsIndexTemplate({name: templateName});
    const {body} = indexTemplateExistsRes;
    if (body) return;
    // template does not exist.  Create
    try {
      indexTemplateExists = await client.indices.putIndexTemplate({
        name: templateName,
        body: {
          "index_patterns": ["my-data*"],
          "data_stream": {},
          "priority": 500,
          "template": {
              "mappings": {
                  "_doc": {
                      "properties": {
                          "@timestamp": {
                              "type": "date"
                          },
                          "prop1": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "prop2": {
                          "type": "text",
                          "fields": {
                              "keyword": {
                                  "type": "keyword",
                                  "ignore_above": 256
                              }
                          }
                      },
                      }
                  }
              },
              "settings": {
                  "index": {
                      "lifecycle": {
                          "name": policyName
                      }
                  }
              }
          }
      },
      });
    } catch (err2) {
      console.error(err2);
    }
  } catch (error) {
    console.error(error);
  } finally {
    return indexTemplateExists;
  }
};


(async ()=>{

// create policy
await createPolicy()

// create template
await createTemplate()

// add data
try{
const bulkRes = await client.bulk({
  index: 'my-data',
  body:[
    {create:{}},
    {"@timestamp": new Date(), "prop1":"some text","prop2":"some text" },
    {create:{}},
    {"@timestamp": new Date(), "prop1":"some text","prop2":"some text" },
    {create:{}},
    {"@timestamp": new Date(), "prop1":"some text","prop2":"some text" },
  ]
  });
  console.log(bulkRes);
}catch(error){
  console.error(error);
}

})()


