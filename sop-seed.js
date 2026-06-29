window.SMART_SOP_SEED = {
  "sops": [
    {
      "id": "9aeeffc2-d3ed-4a48-9bd8-c0e9ecbe52bc",
      "document": {
        "managementNo": "JH-PRD-WS-001",
        "rev": "0",
        "registeredDate": "26.06.09",
        "author": "이종규",
        "status": "배포완료",
        "updatedAt": "2026-06-26T01:21:13.688Z"
      },
      "basic": {
        "vendor": "드림솔",
        "product": "5W 312",
        "process": "타발",
        "equipment": "6호기",
        "establishedDate": "26.06.09",
        "note": ""
      },
      "workSequence": [
        {
          "order": "1",
          "name": "원단 합지",
          "detail": "INT-7501L 투입, 라이너 제거",
          "check": "INT-7501L 투입 방향 확인 라이너가 위로가게 투입"
        },
        {
          "order": "2",
          "name": "원단 합지",
          "detail": "INT-7501L 위에 BLUE+방열패드 합지품 합지",
          "check": "INT-7501L+BLUE+방열패드 합지품 합지 할때 위치 중앙 합지"
        },
        {
          "order": "3",
          "name": "타발기 셋팅",
          "detail": "이송거리 39, 카운터 5으로 지정",
          "check": "첫 타발위치 확인 후 타발"
        },
        {
          "order": "4",
          "name": "컷팅",
          "detail": "1 SHEET 컷",
          "check": ""
        }
      ],
      "processConditions": [
        {
          "no": "1",
          "item": "금형청소",
          "standard": "금형 칼 청소 180타 1번씩",
          "method": "육안",
          "record": "2time/DAY",
          "action": "금형 교체후 보고"
        },
        {
          "no": "2",
          "item": "금형교체",
          "standard": "타발 약 12,000타 후 드림솔 반납",
          "method": "육안",
          "record": "목형관리대장",
          "action": "드림솔 반납"
        },
        {
          "no": "3",
          "item": "이송거리",
          "standard": "39",
          "method": "육안",
          "record": "생산체크시트",
          "action": "재설정 후 진행"
        },
        {
          "no": "4",
          "item": "카운터",
          "standard": "5",
          "method": "육안",
          "record": "생산체크시트",
          "action": "재설정 후 진행"
        },
        {
          "no": "5",
          "item": "미삽,과삽",
          "standard": "자주검사 진행 초물, 3/1, 3/2, 종물(30Set 마다)",
          "method": "육안",
          "record": "생산체크시트",
          "action": "생산 관리자 보고 "
        }
      ],
      "bom": [
        {
          "no": "1",
          "material": "INT-7501L",
          "width": "160",
          "note": ""
        },
        {
          "no": "2",
          "material": "BLUE 이형지",
          "width": "450X150 (SHEET)",
          "note": ""
        },
        {
          "no": "3",
          "material": "PAD",
          "width": "원장 270X215 (반컷팅 135X215)",
          "note": "LOT따라 다소 차이가 있음"
        },
        {
          "no": "4",
          "material": "엠보 PAD",
          "width": "150X235",
          "note": "150재단 후 235 평판"
        }
      ],
      "attachments": {
        "files": []
      },
      "productionChecklist": [
        {
          "no": "1",
          "item": "금형청소",
          "standard": "금형 칼 청소 180타 1번씩",
          "checkMethod": "육안",
          "record": "2time/DAY"
        },
        {
          "no": "2",
          "item": "금형교체",
          "standard": "타발 약 12,000타 후 드림솔 반납",
          "checkMethod": "육안",
          "record": "목형관리대장"
        },
        {
          "no": "3",
          "item": "이송거리",
          "standard": "39",
          "checkMethod": "육안",
          "record": "생산체크시트"
        },
        {
          "no": "4",
          "item": "카운터",
          "standard": "5",
          "checkMethod": "육안",
          "record": "생산체크시트"
        },
        {
          "no": "5",
          "item": "미삽,과삽",
          "standard": "자주검사 진행 초물, 3/1, 3/2, 종물(30Set 마다)",
          "checkMethod": "육안",
          "record": "생산체크시트"
        }
      ],
      "moldLedger": {
        "info": {
          "moldNo": "",
          "moldName": "",
          "location": "",
          "status": "",
          "lastCheckedDate": "",
          "manager": ""
        },
        "history": [
          {
            "date": "",
            "type": "금형청소",
            "detail": "금형 칼 청소 180타 1번씩 / 육안 / 2time/DAY",
            "manager": "",
            "nextAction": "금형 교체후 보고"
          },
          {
            "date": "",
            "type": "금형교체",
            "detail": "타발 약 12,000타 후 드림솔 반납 / 육안 / 목형관리대장",
            "manager": "",
            "nextAction": "드림솔 반납"
          }
        ]
      },
      "revisionHistory": [
        {
          "date": "",
          "author": "",
          "detail": "",
          "rev": ""
        }
      ]
    }
  ],
  "workRecords": []
};
