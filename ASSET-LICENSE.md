# Asset License

This document applies to the visual assets in this repository, including:

- `images/plays/**`
- `images/material/**`
- `images/onboarding/**`
- any other image, illustration, icon, photo, or generated visual asset unless a separate license is provided for that specific file

These assets are proprietary project assets.

## Ownership

Copyright (c) 2026 Nori Recipe project owner.

All rights are reserved unless written permission is granted by the copyright owner.

## Permitted Use

Authorized project maintainers and contributors may use these assets only for developing, testing, building, and distributing this project.

End users may view these assets as presented inside the official application or official project materials.

## Restrictions

You may not, without prior written permission:

- copy, extract, redistribute, or publish these assets outside this project
- use these assets in another application, website, repository, product, dataset, model training set, marketing material, or commercial work
- modify, remix, crop, trace, recreate, or create derivative works from these assets for use outside this project
- sell, sublicense, package, or distribute these assets as standalone files or as part of another asset collection
- claim ownership of these assets

## Source Code License Separation

This document covers visual assets only. It does not define the license for the source code, data files, documentation, dependencies, or third-party materials in this repository.

The project source code license is Apache License 2.0 (see `LICENSE` and `NOTICE`). It does not apply to the visual assets listed above. Their use remains governed by this document or a separate license provided for the specific asset.

## Third-Party Assets

If any asset in this repository is based on or provided by a third party, that asset may also be subject to the original provider's license, terms, or usage restrictions. Those terms remain in effect.

## Permission Requests

For permission to use any visual asset outside this project, contact the project owner and describe the intended use.

## Asset Delivery

As of 2026-11-15, approved play detail images and thumbnails are delivered through Supabase Storage at `clqthwgsmumiwnnqjtbe.supabase.co` from the public `play-assets` bucket. Play originals are stored privately and retained locally by maintainers; they are no longer tracked in the current Git tree. Past Git history is retained. Public delivery does not change the asset license.

Material, onboarding, and brand assets continue to use the existing repository and Vercel delivery. Material-image migration is follow-up work. This technical delivery record does not assert completion of the service's additional provider/privacy notice review, which remains tracked in OpenSpec follow-ups.

## 재료 이미지 제공 — 2026-11-16

기존 재료 JPEG67개는 비공개 Supabase Storage와 관리자 로컬 `images/material/`에 유지하며 검증한 파일의 Git 추적만 제외합니다. 승인된 실제 매핑66개의 서비스용 WebP만 `material-assets` 공개 버킷에서 제공하고 검수 대기5개의 브랜드 기본 표시와 미사용 원본의 비공개 보관을 유지합니다. 이 위치 변경은 기존 이미지의 권리·재배포 허락 범위를 추가로 확정하지 않습니다. 실제 이관/검증·Preview 진행은 `openspec/changes/migrate-material-images-to-supabase-storage/`의 근거를 따르며 Production은 변경하지 않습니다.
