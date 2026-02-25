# Student Management System with Firebase Backend

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Firebase
```bash
firebase login
firebase init firestore
firebase init hosting
```

### 3. Deploy to Firebase
```bash
firebase deploy --only firestore
npm run build
firebase deploy --only hosting
```

## 📋 Features

### ✅ **Offline First**
- Local storage for immediate access
- Works without internet connection
- Auto-syncs when online

### ✅ **Firebase Backend**
- Cloud storage for data persistence
- Real-time synchronization
- Multi-device support

### ✅ **Hybrid Mode**
- Best of both worlds
- Offline + Online capabilities
- Automatic fallback handling

### ✅ **Student Management**
- Add, Edit, Delete students
- Search and filter functionality
- Import/Export data (JSON)

### ✅ **Storage Modes**
- **Hybrid**: Local + Firebase (Recommended)
- **Local**: Offline only
- **Firebase**: Cloud only

## 🔧 Firebase Configuration

Your Firebase project is already configured:
- **Project ID**: klok-2a75e
- **Database**: Firestore
- **Security Rules**: Authenticated users only

## 🌐 Usage

1. **Run Development Server**:
   ```bash
   npm run dev
   ```

2. **Access Application**:
   - Local: http://localhost:3000
   - Online: Deploy to Firebase Hosting

3. **Storage Settings**:
   - Click "Settings" button
   - Choose storage mode
   - Sync data as needed

## 📱 Data Structure

Each student record contains:
- Surname
- Other Names  
- Gender
- Email Address
- Date of Birth
- Role / Rank
- Email Status

## 🔒 Security

- Firebase requires authentication
- Local storage is browser-based
- Data is encrypted in transit

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase
```bash
firebase deploy
```

The application is now ready with both offline and online capabilities!
