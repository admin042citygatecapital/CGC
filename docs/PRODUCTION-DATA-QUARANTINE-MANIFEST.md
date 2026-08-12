# Production test-data quarantine manifest

Status: **PLANNED — NOT APPLIED**

Inventory observed: 2026-08-12

Provider backup reference: `render:dpg-d9r3o0qjobas73bh68s0-a:logical-export:2:2026-08-12`

## Inventory

- 11 customer profiles are unambiguously synthetic. Every address uses a reserved or special-use non-public domain.
- 8 persistent demonstration transaction records are linked to those profiles.
- No customer or transaction row will be deleted. Applying quarantine suspends the profiles, revokes sessions, labels the transaction records, and retains append-only restoration snapshots.
- The exact address list remains in the ignored local operations file and is not committed to source control.

Exact-list confirmation SHA-256:

`a34d3e05967a2c51c429edf267acbeb335ca59bbf1d23969ed527ad242ed2b7f`

Individual address SHA-256 values:

```text
a0c1ddfe7e7304d29b39ff274316bf038271f531da2e263d292da39c751d7e52
119a535348d296d56703700ab574a38831902cddc2bb016b7c9a91fad7593c69
8510aa636c202a3872e20f12545a580a85ca56b74a2857110103e066c01e8d39
fe9cc2d62a644afb76410aeca0d5248ad7a19622e2ddb82e037af9ffd7db6977
0b231df6d2503277ee30950fe379210d39f19015b889c7e51ce2cc65b27809ac
7afd0cb6bef3a9d9cc0619ecde3be6360a876a0a066934f172b28ba7742580bf
f067802e286310ae71854b4441bd5b1cdb558b92590b905c83e5f1535df241cc
49c67a67b9f9012c6b0bbabcf733130009ac6426a8358275f9da9fdc7c1d2a1e
973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b
23a64faa1acc4ed3168493fbece5b78809dce7f8b1f6eb92df689360e939a5a5
4e3cc7c487a7cad7edf96f10eac280847d2d10d10943987057c431e3f18e3255
```

## Apply gate

Do not apply until migrations `0017_data_quarantine.sql` and `0018_kyc_reviewer_identity.sql` are deployed, the live preview reproduces this manifest, and the provider backup is still available. Any candidate-count, transaction-count, or confirmation-hash difference requires a new manifest and approval.

