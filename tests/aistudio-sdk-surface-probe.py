from aistudio_sdk.requests import pipeline as p

names=sorted(n for n in dir(p) if not n.startswith('_'))
assert callable(getattr(p,'query',None))
assert callable(getattr(p,'bosacl_ls_cp',None))
matched=[n for n in names if any(k in n.lower() for k in ('log','detail','info'))]
assert matched
print({'ok':True,'suite':'aistudio-sdk-log-detail-info-surface','matched_count':len(matched)})
