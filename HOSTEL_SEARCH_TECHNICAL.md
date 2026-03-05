# Hostel Search Technical Documentation

This file documents the implementation of the hostel search feature and the technical details of how it interacts with the UPSA Hostel portal.

## 1. Technical Problem & Solution

### Initial Issues
- **Login Failure**: The portal login was failing because the request used nested parameters (e.g., `LoginForm[username]`).
- **Parameter Mismatch**: The search was using incorrect filter model names, causing the portal to ignore queries.
- **Session Handling**: Inconsistent CSRF token extraction caused "Sorry, No Connection" errors.

### Final Solution
- **Direct Login**: Switched to direct `username` and `password` fields for the login POST request.
- **GET Search**: Implemented search using GET requests, which reliably triggers the portal's built-in grid filtering.
- **Model Specificity**: Used `RegistrationListSearch` parameters for precise filtering.

## 2. API Details

### Source URL
`https://upsahostels.com/index.php?r=student/registration-list/index`

### Request Parameters (GET)
| Parameter | Description |
|---|---|
| `RegistrationListSearch[stu_index_number]` | Search by Student Index Number |
| `RegistrationListSearch[name]` | Search by Student Name |
| `RegistrationListSearch[rooms_name]` | Filter by Room Number |
| `per-page=100` | Fetch 100 results per request (optimized for mobile) |
| `page` | Pagination index (1-indexed) |

## 3. Parsing Logic
- **Table Data**: Extracted from `<tbody>` using regex, splitting by `<tr>` and `<td>`.
- **Total Count**: Extracted from the summary text (e.g., *"Showing 1-20 of 3,657 items"*) using a robust regex that handles both singular and plural counts.

---

*Last Updated: March 2026*
