import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion, Timestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

// Global variables
let currentUser = null;
let unsubscribe = null;
let typingTimeout = null;
let attachments = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!window.auth || typeof window.auth.checkAuth !== 'function') {
    console.error("Auth module not loaded properly");
    showErrorMessage("Authentication error. Please refresh the page.");
    return;
  }

  if (!window.auth.checkAuth()) return;

  const userId = sessionStorage.getItem('loggedInUserId');
  if (userId) {
    setupChat(userId);
    setupNavigation();
    setupFileUpload();
    setupImagePreviewModal();
  } else {
    console.error("No user ID found in session storage");
    showErrorMessage("Authentication error. Please log in again.");
  }
});

function setupNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navClose = document.querySelector('.nav-close');
  const mainNav = document.querySelector('.main-nav');

  if (menuToggle && navClose && mainNav) {
    menuToggle.addEventListener('click', () => mainNav.classList.add('active'));
    navClose.addEventListener('click', () => mainNav.classList.remove('active'));
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove('active');
      }
    });
  } else {
    console.warn('Navigation elements not found');
  }
}

async function setupChat(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("User document not found");
    }

    currentUser = { id: userId, ...userDoc.data() };

    // Initialize chat array if missing
    if (!userDoc.data().chat) {
      await setDoc(userRef, { chat: [] }, { merge: true });
    }

    // Setup chat metadata
    const chatMetadataRef = doc(db, "chatMetadata", userId);
    const chatMetadataDoc = await getDoc(chatMetadataRef);
    const userName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown User';
    const userEmail = currentUser.email || 'No email';

    if (!chatMetadataDoc.exists()) {
      await setDoc(chatMetadataRef, {
        userId,
        userName,
        userEmail,
        lastActive: Timestamp.now(),
        unreadCount: 0,
        userUnreadCount: 0,
        lastMessage: null,
        archived: false,
        createdAt: Timestamp.now()
      });
    } else {
      await updateDoc(chatMetadataRef, { 
        userName, 
        userEmail, 
        lastActive: Timestamp.now(),
        userUnreadCount: 0 // Reset unread count when user opens chat
      });
    }

    // Mark admin messages as read
    const userData = userDoc.data();
    if (userData.chat?.length > 0) {
      const updatedChat = userData.chat.map(msg => {
        if (msg.sender === 'admin') {
          return { ...msg, readByUser: true };
        }
        return msg;
      });
      await updateDoc(userRef, { chat: updatedChat });
    }

    // Check admin status
    checkAdminStatus();
    subscribeToChat(userId);
    setupChatForm();
  } catch (error) {
    console.error("Error setting up chat:", error);
    showErrorMessage(`Failed to load chat: ${error.message}`);
  }
}

async function checkAdminStatus() {
  try {
    // Check if any admin is online by looking at the adminStatus document
    const adminStatusRef = doc(db, "adminStatus", "status");
    const adminStatusDoc = await getDoc(adminStatusRef);
    
    if (adminStatusDoc.exists()) {
      const status = adminStatusDoc.data();
      updateAdminStatus(status.online || false);
    } else {
      // Create the document if it doesn't exist
      await setDoc(adminStatusRef, { online: false, lastUpdated: Timestamp.now() });
      updateAdminStatus(false);
    }
    
    // Subscribe to admin status changes
    onSnapshot(adminStatusRef, (doc) => {
      if (doc.exists()) {
        const status = doc.data();
        updateAdminStatus(status.online || false);
      }
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    updateAdminStatus(false);
  }
}

function updateAdminStatus(isOnline) {
  const statusIndicator = document.getElementById('adminStatusIndicator');
  const statusText = document.getElementById('adminStatusText');

  if (statusIndicator && statusText) {
    statusIndicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    statusText.textContent = isOnline ? 'Online' : 'Offline';
  }
}

function subscribeToChat(userId) {
  if (unsubscribe) unsubscribe();

  const userRef = doc(db, "users", userId);
  unsubscribe = onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      const userData = doc.data();
      if (!userData.chat) {
        renderMessages([]);
        return;
      }
      
      renderMessages(userData.chat || []);
      
      // Mark admin messages as read
      const updatedChat = userData.chat.map(msg => {
        if (msg.sender === 'admin' && !msg.readByUser) {
          return { ...msg, readByUser: true };
        }
        return msg;
      });
      
      if (JSON.stringify(updatedChat) !== JSON.stringify(userData.chat)) {
        updateDoc(userRef, { chat: updatedChat });
        
        // Reset user unread count in metadata
        const chatMetadataRef = doc(db, "chatMetadata", userId);
        updateDoc(chatMetadataRef, { userUnreadCount: 0 });
      }
    }
  }, (error) => {
    console.error("Error subscribing to chat updates:", error);
    showErrorMessage("Failed to receive chat updates");
  });
}

function renderMessages(messages) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const loadingElement = chatMessages.querySelector('.chat-loading');
  if (loadingElement) loadingElement.remove();

  if (messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-chat">
        <i class="fas fa-comments"></i>
        <p>No messages yet. Start a conversation!</p>
      </div>
    `;
    return;
  }

  const sortedMessages = [...messages].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
  chatMessages.innerHTML = sortedMessages.map(msg => {
    const isUser = msg.sender === 'user';
    const messageId = msg.id || '';
    const messageTime = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true, day: 'numeric', month: 'short'
    }) : 'Unknown time';

    let messageText = msg.text || '';

    const statusIcon = isUser ? (msg.readByAdmin ? '<i class="fas fa-check-double" style="color: #10b981;"></i>' :
                                msg.deliveredToAdmin ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>') : '';

    let attachmentHtml = '';
    if (msg.attachment) {
      const { type, url, name } = msg.attachment;
      attachmentHtml = type?.startsWith('image/') ?
        `<img src="${url}" alt="Attached image" class="message-image" onclick="openImagePreview('${url}', '${name}')">` :
        `<div class="message-file"><i class="fas ${type?.includes('pdf') ? 'fa-file-pdf' : type?.includes('doc') ? 'fa-file-word' : 'fa-file'}"></i><a href="${url}" target="_blank" download="${name}">${name}</a></div>`;
    }

    return `<div class="message ${isUser ? 'user' : 'admin'}" data-id="${messageId}">
              <div class="message-content">${messageText}</div>
              ${attachmentHtml}
              <div class="message-time">${messageTime}${isUser ? `<span class="message-status">${statusIcon}</span>` : ''}</div>
            </div>`;
  }).join('');

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupChatForm() {
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  
  if (!chatForm || !messageInput) return;

  messageInput.addEventListener('input', () => {
    updateTypingStatus(true);
  });

  // Handle Enter key press
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendButton.disabled) {
        chatForm.dispatchEvent(new Event('submit'));
      }
    }
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if ((!message && attachments.length === 0) || sendButton.disabled) return;

    // Disable send button and clear input immediately
    sendButton.disabled = true;
    const originalMessage = message;
    messageInput.value = '';
    
    try {
      const messageId = Date.now().toString();
      const messageObj = {
        id: messageId,
        text: originalMessage,
        sender: 'user',
        timestamp: Timestamp.now(),
        userName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Unknown User',
        userEmail: currentUser.email || 'No email',
        readByAdmin: false,
        deliveredToAdmin: false
      };

      if (attachments.length > 0) {
        messageObj.attachment = attachments[0];
      }

      const userRef = doc(db, "users", currentUser.id);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) throw new Error("User document missing");

      await updateDoc(userRef, { chat: arrayUnion(messageObj) });

      const chatMetadataRef = doc(db, "chatMetadata", currentUser.id);
      const metadataUpdate = {
        lastActive: Timestamp.now(),
        lastMessage: { 
          text: originalMessage || 'Attachment', 
          timestamp: Timestamp.now(), 
          sender: 'user' 
        }
      };

      const metadataDoc = await getDoc(chatMetadataRef);
      if (!metadataDoc.exists()) {
        await setDoc(chatMetadataRef, {
          userId: currentUser.id,
          userName: messageObj.userName,
          userEmail: messageObj.userEmail,
          unreadCount: 1,
          userUnreadCount: 0,
          archived: false,
          createdAt: Timestamp.now(),
          ...metadataUpdate
        });
      } else {
        const currentUnreadCount = metadataDoc.data().unreadCount || 0;
        await updateDoc(chatMetadataRef, {
          ...metadataUpdate,
          unreadCount: currentUnreadCount + 1
        });
      }

      // Notify admin about new message
      const adminNotificationRef = doc(db, "adminNotifications", "messages");
      await updateDoc(adminNotificationRef, {
        newMessages: arrayUnion({
          userId: currentUser.id,
          userName: messageObj.userName,
          messageId: messageId,
          timestamp: Timestamp.now()
        })
      }).catch(async (error) => {
        if (error.code === 'not-found') {
          await setDoc(adminNotificationRef, {
            newMessages: [{
              userId: currentUser.id,
              userName: messageObj.userName,
              messageId: messageId,
              timestamp: Timestamp.now()
            }]
          });
        } else throw error;
      });

      clearAttachments();
    } catch (error) {
      console.error('Error sending message:', error);
      showErrorMessage(`Failed to send message: ${error.message}`);
      // If there's an error, restore the message
      messageInput.value = originalMessage;
    } finally {
      // Re-enable send button
      sendButton.disabled = false;
    }
  });
}

async function updateTypingStatus(isTyping) {
  if (!currentUser) return;
  
  if (typingTimeout) clearTimeout(typingTimeout);
  
  try {
    const typingStatusRef = doc(db, "typingStatus", currentUser.id);
    await setDoc(typingStatusRef, {
      isTyping,
      userId: currentUser.id,
      userName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      timestamp: Timestamp.now()
    });
    
    // Clear typing status after 3 seconds
    if (isTyping) {
      typingTimeout = setTimeout(async () => {
        await setDoc(typingStatusRef, {
          isTyping: false,
          userId: currentUser.id,
          userName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
          timestamp: Timestamp.now()
        });
      }, 3000);
    }
  } catch (error) {
    console.error("Error updating typing status:", error);
  }
}

function setupFileUpload() {
  const fileInput = document.getElementById('fileAttachment');
  const attachmentPreview = document.getElementById('attachmentPreview');
  if (!fileInput || !attachmentPreview) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      showErrorMessage('File size exceeds 10MB limit');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileUrl = event.target.result;
      attachments = [{ name: file.name, type: file.type, size: file.size, url: fileUrl }];

      attachmentPreview.innerHTML = file.type.startsWith('image/') ?
        `<div class="attachment-item"><img src="${fileUrl}" alt="${file.name}"><span class="remove-attachment" onclick="clearAttachments()">×</span></div>` :
        `<div class="attachment-item"><div class="file-icon"><i class="fas ${file.type.includes('pdf') ? 'fa-file-pdf' : file.type.includes('doc') ? 'fa-file-word' : 'fa-file'}"></i><span class="file-name">${file.name}</span></div><span class="remove-attachment" onclick="clearAttachments()">×</span></div>`;
    };
    reader.readAsDataURL(file);
  });
}

window.clearAttachments = function() {
  attachments = [];
  document.getElementById('attachmentPreview').innerHTML = '';
  document.getElementById('fileAttachment').value = '';
};

function setupImagePreviewModal() {
  const modal = document.getElementById('imagePreviewModal');
  if (!modal) return;
  
  const closeBtn = modal.querySelector('.close-preview');

  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) modal.classList.remove('active');
  });
}

window.openImagePreview = function(imageUrl, imageName) {
  const modal = document.getElementById('imagePreviewModal');
  const previewImage = document.getElementById('previewImage');
  const downloadLink = document.getElementById('downloadLink');
  if (!modal || !previewImage || !downloadLink) return;

  previewImage.src = imageUrl;
  downloadLink.href = imageUrl;
  downloadLink.download = imageName || 'download';
  modal.classList.add('active');
};

function showErrorMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.style.cssText = 'padding: 1rem; margin: 1rem 0; background-color: #fee2e2; color: #b91c1c; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem;';
  errorElement.innerHTML = `<i class="fas fa-exclamation-circle"></i><p style="margin: 0;">${message}</p>`;
  chatMessages.appendChild(errorElement);

  setTimeout(() => errorElement.remove(), 5000);
}

// Listen for admin typing
document.addEventListener('DOMContentLoaded', () => {
  if (!window.auth.checkAuth()) return;
  
  const userId = sessionStorage.getItem('loggedInUserId');
  if (userId) {
    // Listen for admin typing status
    const adminTypingRef = doc(db, "adminTyping", userId);
    onSnapshot(adminTypingRef, (doc) => {
      if (doc.exists() && doc.data().isTyping) {
        showTypingIndicator();
      } else {
        hideTypingIndicator();
      }
    });
  }
});

function showTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.style.display = 'flex';
  }
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.style.display = 'none';
  }
}

window.addEventListener('unload', () => {
  if (unsubscribe) unsubscribe();
  if (typingTimeout) clearTimeout(typingTimeout);
});