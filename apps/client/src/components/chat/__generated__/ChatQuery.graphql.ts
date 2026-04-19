/**
 * @generated SignedSource<<137d6dc254b31e836888e44587e38c69>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ChatQuery$variables = Record<PropertyKey, never>;
export type ChatQuery$data = {
  readonly getMessages: ReadonlyArray<{
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"Message_item">;
  }>;
};
export type ChatQuery = {
  response: ChatQuery$data;
  variables: ChatQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ChatQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Message",
        "kind": "LinkedField",
        "name": "getMessages",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "Message_item"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ChatQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Message",
        "kind": "LinkedField",
        "name": "getMessages",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "author",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "body",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "00081e3294d59131a96ce4127d038769",
    "id": null,
    "metadata": {},
    "name": "ChatQuery",
    "operationKind": "query",
    "text": "query ChatQuery {\n  getMessages {\n    id\n    ...Message_item\n  }\n}\n\nfragment Message_item on Message {\n  author\n  body\n}\n"
  }
};
})();

(node as any).hash = "d501ffe07603b977c71cf74b0f917c9e";

export default node;
