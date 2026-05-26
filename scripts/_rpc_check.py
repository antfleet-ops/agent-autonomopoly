#!/usr/bin/env python3
"""Read-only on-chain portfolio check via JSON-RPC."""
import urllib.request
import json
import time

RPC = "https://base-rpc.publicnode.com"
AGENT = "0x8767Df39eCeeaeB11554642237aC4E08660aB6A3"
WETH  = "0x4200000000000000000000000000000000000006"
DIEM  = "0xF4d97F2da56e8c3098f3a8D538DB630A2606a024"
FEE_LOCKER = "0xF7d3BE3FC0de76fA5550C29A8F6fa53667B876FF"
NFPM  = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"
POOL  = "0x80d995189ecc593672aD4703b250a5e82672EB1D"

def rpc(method, params, id=1):
    body = json.dumps({"jsonrpc":"2.0","method":method,"params":params,"id":id}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read())
    if "error" in data:
        raise Exception(f"RPC error: {data['error']}")
    return data["result"]

def call(to, data, id=1):
    return rpc("eth_call", [{"to": to, "data": data}, "latest"], id)

def hex_to_int(h):
    return int(h, 16)

def hex_to_eth(h):
    return hex_to_int(h) / 1e18

def pad_addr(addr):
    """Pad address to 32-byte ABI encoding."""
    return addr[2:].lower().zfill(64)

def balanceOf(token, addr):
    data = "0x70a08231" + pad_addr(addr)
    return call(token, data)

# --- Wallet balances ---
eth_hex = rpc("eth_getBalance", [AGENT, "latest"])
time.sleep(0.3)
weth_hex = balanceOf(WETH, AGENT)
time.sleep(0.3)
diem_hex = balanceOf(DIEM, AGENT)
time.sleep(0.3)

eth  = hex_to_eth(eth_hex)
weth = hex_to_eth(weth_hex)
diem = hex_to_eth(diem_hex)

print(f"=== PORTFOLIO 2026-05-26 ===")
print(f"ETH:   {eth:.6f}")
print(f"WETH:  {weth:.6f}")
print(f"DIEM:  {diem:.4f}")

# --- FeeLocker ---
# availableFees(address feeOwner, address token) => selector keccak4
# Function: availableFees(address,address)
# sig = keccak256("availableFees(address,address)") first 4 bytes
# Computed: 0x916e3b73  (need to verify — let's use eth_call and check)
feelock_data = "0x916e3b73" + pad_addr(AGENT) + pad_addr(DIEM)
time.sleep(0.3)
feelock_hex = call(FEE_LOCKER, feelock_data)
if feelock_hex and feelock_hex != "0x":
    claimable = hex_to_eth(feelock_hex)
else:
    claimable = 0.0
print(f"FeeLocker claimable: {claimable:.4f} DIEM")

# --- NFPM positions count ---
time.sleep(0.3)
nfpm_bal_hex = balanceOf(NFPM, AGENT)
nfpm_count = hex_to_int(nfpm_bal_hex)
print(f"NFPM positions: {nfpm_count}")

# --- Pool slot0 for current tick ---
# slot0() selector: keccak256("slot0()") = 0x3850c7bd
time.sleep(0.3)
slot0_hex = call(POOL, "0x3850c7bd")
# Returns: sqrtPriceX96 (160bit), tick (24bit signed), ...
# Decode: first 32 bytes = sqrtPriceX96, next 32 bytes = tick
slot0_data = slot0_hex[2:]  # strip 0x
sqrt_price_hex = slot0_data[0:64]
tick_hex = slot0_data[64:128]
tick_raw = int(tick_hex, 16)
# tick is int24 — check sign bit (bit 23)
if tick_raw >= 2**23:
    tick_raw -= 2**24
current_tick = tick_raw
print(f"Pool tick: {current_tick}")
print()

# --- Per-position data ---
# tokenOfOwnerByIndex(address,uint256) = keccak4("tokenOfOwnerByIndex(address,uint256)")
# = 0x2f745c59

out_of_range_ids = []
positions_summary = []

for i in range(nfpm_count):
    time.sleep(0.3)
    idx_hex = hex(i)[2:].zfill(64)
    toi_data = "0x2f745c59" + pad_addr(AGENT) + idx_hex
    token_id_hex = call(NFPM, toi_data)
    token_id = hex_to_int(token_id_hex)

    # positions(uint256) = 0x99fbab88
    time.sleep(0.3)
    token_id_padded = hex(token_id)[2:].zfill(64)
    pos_data = "0x99fbab88" + token_id_padded
    pos_hex = call(NFPM, pos_data)

    # Decode positions result (12 fields x 32 bytes each)
    pos_raw = pos_hex[2:]
    words = [pos_raw[k*64:(k+1)*64] for k in range(12)]
    # nonce(96), operator(160), token0(160), token1(160), fee(24), tickLower(24), tickUpper(24),
    # liquidity(128), feeGrowthInside0LastX128(256), feeGrowthInside1LastX128(256),
    # tokensOwed0(128), tokensOwed1(128)
    tick_lower_raw = int(words[5], 16)
    tick_upper_raw = int(words[6], 16)
    if tick_lower_raw >= 2**23: tick_lower_raw -= 2**24
    if tick_upper_raw >= 2**23: tick_upper_raw -= 2**24
    liquidity = int(words[7], 16)
    tokens_owed0 = int(words[10], 16)
    tokens_owed1 = int(words[11], 16)

    in_range = (current_tick > tick_lower_raw) and (current_tick < tick_upper_raw)
    burned = liquidity == 0
    status = "BURNED" if burned else ("IN_RANGE" if in_range else "OUT_OF_RANGE")

    print(f"tokenId: {token_id}")
    print(f"  range:     [{tick_lower_raw}, {tick_upper_raw}]")
    print(f"  tick:      {current_tick}  -> {status}")
    print(f"  liquidity: {liquidity}")
    print(f"  owed0:     {tokens_owed0/1e18:.8f} WETH")
    print(f"  owed1:     {tokens_owed1/1e18:.8f} DIEM")
    print()

    positions_summary.append((token_id, tick_lower_raw, tick_upper_raw, liquidity, status))
    if not burned and not in_range:
        out_of_range_ids.append(token_id)

print(f"OUT_OF_RANGE tokenIds: {out_of_range_ids if out_of_range_ids else 'none'}")
print(f"ETH gas check: {'OK' if eth > 0.003 else 'LOW - need top-up'}")
