"""Universal AI cost model, Draft 0.2.
All prices USD, list prices checked 18 Nov 2026. Token counts already include an
assumed 2.5x inflation for Ethiopic/Oromo text (to be replaced by Phase 0 measurement).
"""
import json

M = 1e-6
# Provider prices (per token)
FAST = dict(inp=0.10 * M, cached=0.01 * M, out=0.50 * M)      # Claude Haiku 5.5 (<=100K prompt)
MAIN = dict(inp=2.00 * M, cached=0.10 * M, out=10.00 * M)     # Claude Sonnet 5.5
SEARCH = 10 / 1000                                            # per web search
SANDBOX_PER_SEC = 2 * 0.000014 + 4 * 0.0000045                # E2B 2 vCPU + 4 GiB
IMAGE = 0.04                                                  # medium square image (OpenAI list, approx.)
VIDEO_PER_SEC = 0.10                                          # Veo 3.1 Fast 720p


def tok(price, inp, cached_share, out):
    cached = inp * cached_share
    return (inp - cached) * price["inp"] + cached * price["cached"] + out * price["out"]


unit = {}
chat_fast = tok(FAST, 6_000, 0.5, 1_000)
chat_main = tok(MAIN, 8_000, 0.6, 1_200)
unit["Text conversation"] = 0.8 * chat_fast + 0.2 * chat_main
unit["Research"] = tok(MAIN, 60_000, 0.5, 5_000) + 5 * SEARCH
unit["Document generation"] = tok(MAIN, 25_000, 0.5, 12_000)
unit["Coding and websites"] = tok(MAIN, 150_000, 0.7, 20_000)
unit["Sandbox execution"] = 600 * SANDBOX_PER_SEC            # 10-minute run
unit["Image generation"] = IMAGE
unit["Video generation"] = 8 * VIDEO_PER_SEC                  # one 8-second clip

# Monthly activity per user, by profile
profiles = {
    "Light":   {"Text conversation": 20, "Research": 2, "Document generation": 1, "Coding and websites": 0,
                "Sandbox execution": 0, "Image generation": 0, "Video generation": 0},
    "Average": {"Text conversation": 60, "Research": 8, "Document generation": 6, "Coding and websites": 3,
                "Sandbox execution": 4, "Image generation": 5, "Video generation": 0},
    "Heavy":   {"Text conversation": 200, "Research": 30, "Document generation": 25, "Coding and websites": 20,
                "Sandbox execution": 15, "Image generation": 20, "Video generation": 2},
}
mix = {"Light": 0.6, "Average": 0.3, "Heavy": 0.1}

per_user = {p: {c: n * unit[c] for c, n in acts.items()} for p, acts in profiles.items()}
per_user["Blended"] = {c: sum(mix[p] * per_user[p][c] for p in mix) for c in unit}

# Fixed platform costs by scale (approximate, see blueprint section 11)
fixed = {100: 50, 1_000: 305, 10_000: 1_150, 100_000: 9_800}

totals = {}
for n, f in fixed.items():
    totals[n] = {}
    for p in ["Light", "Average", "Heavy", "Blended"]:
        variable = n * sum(per_user[p].values())
        totals[n][p] = round(variable + f)

out = {
    "unit_costs": {c: round(v, 4) for c, v in unit.items()},
    "per_user_month": {p: {c: round(v, 3) for c, v in d.items()} | {"total": round(sum(d.values()), 2)}
                       for p, d in per_user.items()},
    "fixed": fixed,
    "monthly_totals": totals,
}
# Sensitivity: main-model token share of blended variable cost, and effect of a 50% cheaper main model
main_cats = ["Research", "Document generation", "Coding and websites"]
blend = per_user["Blended"]
main_tokens = (sum(blend[c] for c in main_cats) - mix["Light"] * 2 * 5 * SEARCH - mix["Average"] * 8 * 5 * SEARCH
               - mix["Heavy"] * 30 * 5 * SEARCH) + profiles["Light"]["Text conversation"] * 0  # chat main share small
out["sensitivity"] = {
    "blended_total": round(sum(blend.values()), 2),
    "main_model_token_cost": round(main_tokens, 2),
    "share": round(main_tokens / sum(blend.values()), 3),
    "blended_if_main_50pct_cheaper": round(sum(blend.values()) - main_tokens / 2, 2),
}
print(json.dumps(out, indent=1))
