"""Private diagnostics: print schemas and structured-output shapes, never reasoning or credentials."""
import json
import sqlite3
from pathlib import Path

connection=sqlite3.connect('file:.runtime/data/gaia-opencode.sqlite?mode=ro',uri=True)
connection.row_factory=sqlite3.Row
names=[row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print('Message tables:',[name for name in names if 'message' in name])
if 'session_message' not in names:
    raise SystemExit('No expected message projection; do not guess a private schema.')
print('Message columns:',[row[1] for row in connection.execute('PRAGMA table_info(session_message)')])
workspace=json.loads(Path('.runtime/data/workspace.json').read_text(encoding='utf-8'))
session=next(item for item in (workspace if isinstance(workspace,list) else workspace['sessions']) if item.get('taskGraph'))
for role,session_id in session.get('threads',{}).items():
    if role=='gaia':
        continue
    for row in connection.execute('SELECT data FROM session_message WHERE session_id=? AND type=? ORDER BY seq DESC LIMIT 12',(session_id,'assistant')):
        for part in json.loads(row['data']).get('content',[]):
            if part.get('type')=='tool':
                print(role,'tool envelope:',{key:value for key,value in part.items() if key in ('name','status')},'fields:',list(part))
                state=part.get('state',{})
                print('Tool state:',state.get('type'),'fields:',list(state))
                if part.get('name')=='gaia_acquire':
                    print('Acquisition result fields:',{key:value for key,value in state.items() if key in ('input','error')})
    rows=connection.execute('SELECT data FROM session_message WHERE session_id=? AND type=? ORDER BY seq DESC LIMIT 1',(session_id,'assistant')).fetchall()
    if not rows:
        print(role,'no assistant message')
        continue
    data=json.loads(rows[0]['data'])
    parts=data.get('content',[])
    text='\n'.join(part.get('text','') for part in parts if part.get('type')=='text').strip()
    text=text.removeprefix('```json').removeprefix('```').removesuffix('```').strip()
    try:
        value=json.loads(text)
        print(role,'JSON keys:',list(value),'field types:',{key:type(item).__name__ for key,item in value.items()},'protocol:',value.get('protocol'),'evidence ID count:',len(value.get('evidence_ids',[])))
        print('Schema lengths:',len(value.get('summary','')),[len(item) for item in value.get('gaps',[])],'all artifact IDs owned:',all(item in {artifact['id'] for artifact in session['artifacts']} for item in value.get('evidence_ids',[])))
    except (ValueError,TypeError):
        print(role,'No valid final JSON; text length:',len(text),'finish:',data.get('finish'),'error type:',type(data.get('error')).__name__)
