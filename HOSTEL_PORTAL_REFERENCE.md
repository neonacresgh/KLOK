# Hostel Portal Reference Guide

This document serves as a technical and administrative reference for the UPSA Hostel Portal integration within KLOK.

## 🏨 Hostels & Halls

Based on system analysis, the following are the primary hostel buildings and their identifying names as used in the portal:

| Hostel Name | Common Hall Assignments |
| :--- | :--- |
| **UPSA Hostel A** | Main / Building A |
| **Matthew Opoku** | Matthew Opoku-Prempeh Hostel |
| **Ken Nartey** | Ken Ofori-Atta Hostel |
| **Mensa Otabil** | Mensa Otabil Hostel |

## 🚪 Structured Room Data

The full list of available rooms is maintained in `public/hostel_rooms.json`. This data is structured as follows:

```json
{
  "id": "Internal ID",
  "room": "Room Number",
  "hostel": "Building Name",
  "label": "Display Label"
}
```

## 🧩 UI Components

### PremiumRoomSelector (@/components/PremiumRoomSelector.tsx)
A custom, searchable dropdown that uses the structured JSON data. It supports searching by both room number and hostel name, providing a premium experience with glassmorphism and smooth animations.

## 🔗 Integrated API Endpoints

### Internal KLOK Proxies
These endpoints are part of the KLOK application and handle authentication and parsing.

*   **POST** `/api/hostel-search`: Primary search proxy. Accepts `query`, `hostelName`, `roomName`.
*   **POST** `/api/upsa-hostel`: Handles session-forwarding and auto-login for administrators.

### External Portal Endpoints
Direct links to the UPSA Hostel Portal administrative pages (Requires Login).

| Purpose | URL |
| :--- | :--- |
| **Registration List** | [student/registration-list/index](https://upsahostels.com/index.php?r=student/registration-list/index) |
| **Booking Status** | [student/booking-status/index](https://upsahostels.com/index.php?r=student/booking-status/index) |
| **Rooms View** | [hostel/rooms/roomsview](https://upsahostels.com/index.php?r=hostel/rooms/roomsview) |
| **Login Page** | [site/login](https://upsahostels.com/index.php?r=site/login) |

## 🛠️ Developer Notes

*   **Authentication**: Admin sessions are managed via `PHPSESSID` and CSRF tokens (`_csrf-frontend`).
*   **Filtering**: Filtering by Room uses the `RegistrationListSearch[rooms_name]` parameter.
*   **Parsing**: Table data is parsed from `<tbody>` using positional indices. Standard indices are:
    *   `1`: ID / Index Number
    *   `2`: Full Name
    *   `3`: Level
    *   `4`: Hostel
    *   `6`: Room
    *   `7`: Bed
    *   `9`: Payment Status
