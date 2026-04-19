/**
 * @generated SignedSource<<0fec6528a6e661fddc0b8867b24c5498>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ChatMessageAddedSubscription$variables = Record<PropertyKey, never>;
export type ChatMessageAddedSubscription$data = {
  readonly MessageAdded: {
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"Message_item">;
  };
};
export type ChatMessageAddedSubscription = {
  response: ChatMessageAddedSubscription$data;
  variables: ChatMessageAddedSubscription$variables;
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
    "name": "ChatMessageAddedSubscription",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Message",
        "kind": "LinkedField",
        "name": "MessageAdded",
        "plural": false,
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
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ChatMessageAddedSubscription",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Message",
        "kind": "LinkedField",
        "name": "MessageAdded",
        "plural": false,
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
    "cacheID": "7c52dfe76e6ef8b8b52c8b5517735e1d",
    "id": null,
    "metadata": {},
    "name": "ChatMessageAddedSubscription",
    "operationKind": "subscription",
    "text": "subscription ChatMessageAddedSubscription {\n  MessageAdded {\n    id\n    ...Message_item\n  }\n}\n\nfragment Message_item on Message {\n  author\n  body\n}\n"
  }
};
})();

(node as any).hash = "1b92f4dcc476524fa1dd64ae29b59953";

export default node;
