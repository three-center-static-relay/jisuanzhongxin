from aistudio_sdk.requests import pipeline as p

names=sorted(n for n in dir(p) if not n.startswith('_'))
assert callable(getattr(p,'query',None))
matched=[n for n in names if any(k in n.lower() for k in ('detail','info')) and callable(getattr(p,n,None))]
assert matched
print({'ok':True,'suite':'aistudio-sdk-callable-detail-info','matched_count':len(matched)})
