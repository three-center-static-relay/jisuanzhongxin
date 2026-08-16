from aistudio_sdk.requests import pipeline as p

names=sorted(n for n in dir(p) if not n.startswith('_'))
assert callable(getattr(p,'query',None))
matched=[n for n in names if 'log' in n.lower() and callable(getattr(p,n,None))]
assert matched
print({'ok':True,'suite':'aistudio-sdk-callable-log-surface','matched_count':len(matched)})
