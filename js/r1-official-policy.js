import {FIRST_ROUND_ID} from './round-context.js';

export const STANDARD_R1_POLICY_VERSION='r1-standard-v1';
export const ZIPPY_R1_POLICY_VERSION='r1-official-zippy-v1';
export const ZIPPY_R1_POLICY_V2_VERSION='r1-official-zippy-v2';
export const ZIPPY_ID='52385ac3-2e09-4df9-a04c-ca4348cf42d6';

// Registry entries are reviewed product decisions, never supplied by source JSON.
// recordedOn is our policy record date, not an organizer's decision timestamp.
const zippy=Object.freeze({
 roundId:FIRST_ROUND_ID,participantId:ZIPPY_ID,validScoreCount:6,
 allScoresValid:true,officialOutcome:'pass',
 basis:'Owner-approved product decision DATA-02A, authorized for implementation in DATA-02B.1',
 recordedOn:'2026-10-22',officialDecisionAt:null,
 label:'6 действительных оценок · официальный проход'
});
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const zippyV2=freeze({
  "roundId": "c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c",
  "participantId": "52385ac3-2e09-4df9-a04c-ca4348cf42d6",
  "policyVersion": "r1-official-zippy-v2",
  "validScoreCount": 5,
  "allScoresValid": false,
  "officialOutcome": "pass",
  "basis": "Owner-confirmed DATA-02C.1 / authorized DATA-02C.2; API removal unconfirmed",
  "recordedOn": "2026-10-23",
  "officialDecisionAt": null,
  "annulmentDecisionAt": null,
  "label": "5 действительных оценок · официальный проход",
  "cancelledEvent": {
    "roundId": "c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c",
    "participantId": "52385ac3-2e09-4df9-a04c-ca4348cf42d6",
    "judgeId": "df69c076-dd85-4503-939f-12dc1ef397ba",
    "judgeName": "Игорь Кедо",
    "score": 3,
    "scoredAt": "2026-10-19T10:40:38.794Z",
    "commentSha256": "fe22bf1f91b44aa6ad5f88df428369de96cfea56d5dcc323a35e469d89234e4d",
    "fingerprint": "398c10f505c3ba342276d39f5bdb819b608ce657cded90264f238e6e56459a15"
  },
  "survivorFingerprints": [
    "ab4d4b055cd0030d6591bd645bd44604069e12149f109a4ad0928a28f3b9803b",
    "5fc31971de61682f14c60bd249188d80b6d63dc99e5e70d7da123ed940269b72",
    "06443771d910276dd7c21376d1fdc6a889e8c2b097faed2889466ca107644159",
    "0d624a57e8bdd8bbcb4c657bc9f89df32ea0f3a3bc804a4b552977bc6c102e63",
    "df696d12564446ff83bdf25141f366f87940f04df0ca2dd4bfa269c76775869f"
  ],
  "survivorIdentities": [
    {
      "judgeName": "СТИШ",
      "judgeId": "86168a35-7df8-4ab5-ba67-46dc6bc22944"
    },
    {
      "judgeName": "Illumate",
      "judgeId": "a2181b3e-81a6-4e7d-b9b2-d10f4cb20b2b"
    },
    {
      "judgeName": "Никсон",
      "judgeId": "c4b430b0-bd0c-4ec5-9dd0-3282b1aeb276"
    },
    {
      "judgeName": "XSive MC",
      "judgeId": "0965e5cc-ff25-4aef-85fa-b0fafef7decc"
    },
    {
      "judgeName": "KseroN",
      "judgeId": "ba786673-683d-4468-96d2-86b5dc794f4e"
    }
  ],
  "archivedCancelledScore": {
    "judgeName": "Игорь Кедо",
    "score": 3,
    "comment": "Местами было прям прикольно по тексту и конструкции. Просто в моменте совсем забил на рифмовку)",
    "scoredAt": "2026-10-19T10:40:38.794Z"
  },
  "archiveSource": {
    "runId": "2026-10-22T19:42:08.167Z",
    "path": "docs/data-candidates/r1-2026-10-22-194208/19ib_all_judges_REPAIRED.json",
    "sha256": "80a1b3c3dd8c972437353248efa47c30f213389055abc48f6fe8a40bc718c6d3"
  },
  "sourceStates": [
    {
      "mode": "A",
      "runId": "2026-10-22T19:42:08.167Z",
      "rawScoreCount": 6,
      "contentHashes": {
        "main": "025c7aafbe85061b4205c2a63a850637d6f797e1b9900c950ce677630f627198",
        "forum": "3a66f8d990fecf641fb69f29d41509779616944f14b66805ba6148b0d7b324a0",
        "metadata": "429f73f0be292b47779a395857c4ff80a4c20b3726b2bfa0ab8dfe3c0fb34469",
        "history": "2428468738d8be580594ae8a9fff68be2ec98f49ce66db364227576d36eacb46"
      }
    }
  ]
});
const policies=Object.freeze({
 [ZIPPY_R1_POLICY_V2_VERSION]:Object.freeze({roundId:FIRST_ROUND_ID,version:ZIPPY_R1_POLICY_V2_VERSION,exceptions:Object.freeze([zippyV2])}),
 [STANDARD_R1_POLICY_VERSION]:Object.freeze({roundId:FIRST_ROUND_ID,version:STANDARD_R1_POLICY_VERSION,exceptions:Object.freeze([])}),
 [ZIPPY_R1_POLICY_VERSION]:Object.freeze({roundId:FIRST_ROUND_ID,version:ZIPPY_R1_POLICY_VERSION,exceptions:Object.freeze([zippy])})
});

export function officialR1Policy(version=STANDARD_R1_POLICY_VERSION){
 if(typeof version!=='string'||!Object.hasOwn(policies,version))throw new Error('Unsupported R1 official policy: '+String(version));
 return policies[version];
}
