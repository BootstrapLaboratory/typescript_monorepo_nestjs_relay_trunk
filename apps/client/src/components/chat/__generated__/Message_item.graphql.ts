/**
 * @generated SignedSource<<3f652da24f61b32c9b697f9a5edabda1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type Message_item$data = {
  readonly author: string | null | undefined;
  readonly body: string;
  readonly " $fragmentType": "Message_item";
};
export type Message_item$key = {
  readonly " $data"?: Message_item$data;
  readonly " $fragmentSpreads": FragmentRefs<"Message_item">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "Message_item",
  "selections": [
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
  "type": "Message",
  "abstractKey": null
};

(node as any).hash = "aec1f81f5fc701f11d1a68b51a3e29ea";

export default node;
