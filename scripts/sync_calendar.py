#!/usr/bin/env python3
"""Save dion1727's public GitHub contribution calendar for the Pages arcade.

Authenticates to GitHub GraphQL using the workflow's scoped GITHUB_TOKEN.
Fallback uses a publicly documented community mirror of the public graph.
It never invents contribution counts when upstreams fail.
"""
from __future__ import annotations
import datetime as dt
import json
import os
import pathlib
import urllib.error
import urllib.request

USER = 'dion1727'
DEST = pathlib.Path(__file__).resolve().parents[1] / 'docs' / 'data' / 'contributions.json'
GRAPHQL = """query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}"""
LEVELS = {'NONE':0,'FIRST_QUARTILE':1,'SECOND_QUARTILE':2,'THIRD_QUARTILE':3,'FOURTH_QUARTILE':4}

def request_json(url: str, data=None, token=None):
    headers={'Accept':'application/json','User-Agent':'Dion-Profile-Contribution-Arcade/1.0'}
    if token: headers['Authorization']=f'Bearer {token}'
    if data is not None: headers['Content-Type']='application/json'
    req=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=headers)
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.loads(response.read().decode('utf-8'))

def from_graphql(token):
    data=request_json('https://api.github.com/graphql', {'query':GRAPHQL,'variables':{'login':USER}},token)
    if data.get('errors'): raise ValueError('GraphQL returned errors: '+str(data['errors'])[:500])
    calendar=data['data']['user']['contributionsCollection']['contributionCalendar']
    days=[]
    for wk in calendar['weeks']:
        for d in wk['contributionDays']:
            days.append({'date':d['date'],'count':int(d['contributionCount']),'level':LEVELS.get(d['contributionLevel'],0)})
    return days,'GitHub GraphQL'

def from_public():
    d=request_json(f'https://github-contributions-api.jogruber.de/v4/{USER}?y=last')
    days=[{'date':x['date'],'count':int(x['count']),'level':int(x.get('level') or 0)} for x in d['contributions']]
    return days,'Public contribution mirror (1-hour cache)'

def main():
    token=os.environ.get('GH_TOKEN','').strip()
    errors=[];days=None;source=None
    if token:
        try:days,source=from_graphql(token)
        except Exception as e:errors.append(f'GraphQL: {type(e).__name__}: {e}')
    if days is None:
        try:days,source=from_public()
        except Exception as e:errors.append(f'Public mirror: {type(e).__name__}: {e}')
    if not days:
        raise SystemExit('No genuine calendar available. Existing data preserved. '+' | '.join(errors))
    days=sorted({x['date']:x for x in days}.values(),key=lambda x:x['date'])
    # Validate genuine dates, counts and chronological ordering. No placeholders.
    for d in days:
        dt.date.fromisoformat(d['date'])
        if d['count']<0 or not 0<=d['level']<=4:raise ValueError('Invalid contribution payload')
    prev=json.loads(DEST.read_text()) if DEST.exists() else {}
    comparable={'username':USER,'status':'ready','source':source,'days':days,'total':sum(x['count'] for x in days)}
    old={k:prev.get(k) for k in comparable}
    if comparable==old:
        print(f'Calendar unchanged: {len(days)} days. No commit needed.')
        return
    out={**comparable,'fetched_at':dt.datetime.now(dt.timezone.utc).isoformat()}
    DEST.parent.mkdir(parents=True,exist_ok=True)
    DEST.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
    print(f'Updated {len(days)} REAL days from {source}, total={out["total"]}.')

if __name__=='__main__':main()
