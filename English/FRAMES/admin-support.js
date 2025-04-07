import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, getDocs, addDoc, Timestamp, deleteDoc, setDoc, where } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

// Global variables
let currentChat = null;
let chatSubscriptions = {};
let metadataSubscription = null;
let typingTimeouts = {};
let attachments = [];
let unreadMessageCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication first
  if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = 'admin-login.html';
    return;
  }

  setupNavigation();
  setupEventListeners();
  loadConversations();
  setupAdminStatus(true);
  setupFileUpload();
  setupImagePreviewModal();
});

function setupNavigation() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navClose = document.querySelector('.nav-close');
  const mainNav = document.querySelector('.main-nav');

  if (menuToggle && navClose && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.add('active');
    });

    navClose.addEventListener('click', () => {
      mainNav.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove('active');
      }
    });
  }
}

function setupEventListeners() {
  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Search conversations
  document.getElementById('searchConversations').addEventListener('input', filterConversations);

  // Sort conversations
  document.getElementById('sortConversations').addEventListener('change', sortConversations);

  // Show archived checkbox
  document.getElementById('showArchived').addEventListener('change', renderConversations);

  // Export chat button
  document.getElementById('exportChatBtn').addEventListener('click', exportChat);

  // Archive chat button
  document.getElementById('archiveChatBtn').addEventListener('click', archiveChat);

  // Quick responses
  const quickResponses = document.querySelectorAll('.quick-response-btn');
  quickResponses.forEach(btn => {
    btn.addEventListener('click', () => {
      const response = btn.dataset.response;
      document.getElementById('adminMessageInput').value = response;
    });
  });

  // Chat form
  const chatForm = document.getElementById('adminChatForm');
  chatForm.addEventListener('submit', handleSendMessage);

  // Message input typing detection
  const messageInput = document.getElementById('adminMessageInput');
  messageInput.addEventListener('input', () => {
    if (currentChat) {
      updateAdminTypingStatus(currentChat.userId, true);
    }
  });

  // Back to conversations button (mobile)
  document.querySelector('.back-to-conversations').addEventListener('click', backToConversations);
}

async function setupAdminStatus(isOnline) {
  try {
    const adminStatusRef = doc(db, "adminStatus", "status");
    await setDoc(adminStatusRef, {
      online: isOnline,
      lastUpdated: Timestamp.now()
    });
  } catch (error) {
    console.error("Error updating admin status:", error);
  }
}

async function loadConversations() {
  try {
    // Clear any existing subscriptions
    if (metadataSubscription) {
      metadataSubscription();
    }

    // Get chat metadata for all users
    const chatMetadataRef = collection(db, "chatMetadata");
    const q = query(chatMetadataRef, orderBy("lastActive", "desc"));
    
    // Subscribe to real-time updates
    metadataSubscription = onSnapshot(q, (snapshot) => {
      const conversations = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        conversations.push({
          userId: doc.id,
          userName: data.userName || 'Unknown User',
          userEmail: data.userEmail || 'No email',
          lastMessage: data.lastMessage || null,
          unreadCount: data.unreadCount || 0,
          lastActive: data.lastActive || null,
          archived: data.archived || false,
          archivedAt: data.archivedAt || null
        });
      });
      
      // Store conversations and render them
      window.conversations = conversations;
      renderConversations();
      
      // Clear loading state
      const loadingSpinner = document.querySelector('.loading-spinner-container');
      if (loadingSpinner) {
        loadingSpinner.remove();
      }
    }, (error) => {
      console.error("Error loading conversations:", error);
      document.getElementById('conversationList').innerHTML = `
        <div class="error-message">
          <p>Error loading conversations. Please refresh the page.</p>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error setting up conversations listener:", error);
  }
}

function renderConversations() {
  const conversationList = document.getElementById('conversationList');
  const showArchived = document.getElementById('showArchived').checked;
  let conversations = window.conversations || [];
  
  // Filter conversations based on search input
  const searchQuery = document.getElementById('searchConversations').value.toLowerCase();
  if (searchQuery) {
    conversations = conversations.filter(conv => 
      conv.userName.toLowerCase().includes(searchQuery) || 
      conv.userEmail.toLowerCase().includes(searchQuery)
    );
  }
  
  // Filter archived conversations
  if (!showArchived) {
    conversations = conversations.filter(conv => !conv.archived);
  }
  
  // Sort conversations
  const sortBy = document.getElementById('sortConversations').value;
  sortConversations(sortBy, conversations);
  
  if (conversations.length === 0) {
    conversationList.innerHTML = `
      <div class="empty-conversations">
        <i class="fas fa-comments"></i>
        <p>No conversations found</p>
      </div>
    `;
    return;
  }
  
  conversationList.innerHTML = conversations.map(conv => {
    const lastMessageTime = conv.lastMessage?.timestamp ? 
      formatMessageTime(new Date(conv.lastMessage.timestamp.seconds * 1000)) : '';
    
    const lastMessageText = conv.lastMessage?.text || 'No messages yet';
    
    return `
      <div class="conversation-item ${conv.unreadCount > 0 ? 'unread' : ''} ${conv.archived ? 'archived' : ''} ${currentChat && currentChat.userId === conv.userId ? 'active' : ''}" 
           data-user-id="${conv.userId}" 
           onclick="selectConversation('${conv.userId}')">
        <div class="conversation-header">
          <div class="user-name">
            ${conv.userName}
            ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
          </div>
        </div>
        <div class="user-email">${conv.userEmail}</div>
        <div class="last-message">
          <span class="last-message-text">${lastMessageText}</span>
          <span class="last-message-time">${lastMessageTime}</span>
        </div>
        ${conv.archived ? `
          <div class="archived-label">Archived</div>
          <div class="archived-actions">
            <button class="unarchive-btn" onclick="unarchiveChat('${conv.userId}'); event.stopPropagation();">
              <i class="fas fa-box-open"></i> Unarchive
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function formatMessageTime(date) {
  const now = new Date();
  const diff = now - date;
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (diff < oneDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 7 * oneDay) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function filterConversations() {
  renderConversations();
}

function sortConversations(sortType, conversations) {
  const sortBy = typeof sortType === 'string' ? sortType : document.getElementById('sortConversations').value;
  const convs = conversations || window.conversations || [];
  
  switch (sortBy) {
    case 'recent':
      convs.sort((a, b) => {
        const timeA = a.lastActive?.seconds || 0;
        const timeB = b.lastActive?.seconds || 0;
        return timeB - timeA;
      });
      break;
    case 'unread':
      convs.sort((a, b) => b.unreadCount - a.unreadCount);
      break;
    case 'name':
      convs.sort((a, b) => a.userName.localeCompare(b.userName));
      break;
  }
  
  if (conversations) {
    return convs;
  } else {
    renderConversations();
  }
}

window.selectConversation = function(userId) {
  // Unsubscribe from previous chat if exists
  if (currentChat && chatSubscriptions[currentChat.userId]) {
    chatSubscriptions[currentChat.userId]();
  }
  
  // Find the conversation
  const conversation = window.conversations.find(conv => conv.userId === userId);
  if (!conversation) return;
  
  currentChat = conversation;
  
  // Update UI
  document.getElementById('chatUserName').textContent = conversation.userName;
  document.getElementById('chatUserEmail').textContent = conversation.userEmail;
  
  // Update archive button text
  const archiveChatBtn = document.getElementById('archiveChatBtn');
  if (conversation.archived) {
    archiveChatBtn.innerHTML = '<i class="fas fa-box-open"></i> Unarchive';
    archiveChatBtn.onclick = () => unarchiveChat(userId);
  } else {
    archiveChatBtn.innerHTML = '<i class="fas fa-archive"></i> Archive';
    archiveChatBtn.onclick = archiveChat;
  }
  
  // Show chat interface
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatInterface').style.display = 'flex';
  
  // Mark conversation as active in the list
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`.conversation-item[data-user-id="${userId}"]`)?.classList.add('active');
  
  // Load chat messages
  loadChatMessages(userId);
  
  // Reset unread count
  resetUnreadCount(userId);
  
  // On mobile, show chat window
  if (window.innerWidth <= 768) {
    document.querySelector('.support-sidebar').classList.add('hidden');
    document.querySelector('.chat-window').classList.add('active');
  }
};

window.backToConversations = function() {
  // On mobile, show conversation list
  document.querySelector('.support-sidebar').classList.remove('hidden');
  document.querySelector('.chat-window').classList.remove('active');
};

async function loadChatMessages(userId) {
  try {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
      <div class="chat-loading">
        <div class="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    `;
    
    const userRef = doc(db, "users", userId);
    
    // Subscribe to real-time updates
    chatSubscriptions[userId] = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const chat = userData.chat || [];
        
        if (chat.length === 0) {
          chatMessages.innerHTML = `
            <div class="empty-chat">
              <i class="fas fa-comments"></i>
              <p>No messages yet. Start a conversation!</p>
            </div>
          `;
        } else {
          // Sort messages by timestamp
          const sortedMessages = [...chat].sort((a, b) => 
            (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)
          );
          
          // Render messages
          chatMessages.innerHTML = sortedMessages.map(msg => {
            const isAdmin = msg.sender === 'admin';
            const messageTime = msg.timestamp ? 
              new Date(msg.timestamp.seconds * 1000).toLocaleString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true
              }) : 'Unknown time';
            
            let attachmentHtml = '';
            if (msg.attachment) {
              const { type, url, name } = msg.attachment;
              attachmentHtml = type?.startsWith('image/') ?
                `<img src="${url}" alt="Attached image" class="message-image" onclick="openImagePreview('${url}', '${name}')">` :
                `<div class="message-file"><i class="fas ${type?.includes('pdf') ? 'fa-file-pdf' : type?.includes('doc') ? 'fa-file-word' : 'fa-file'}"></i><a href="${url}" target="_blank" download="${name}">${name}</a></div>`;
            }
            
            return `
              <div class="message ${isAdmin ? 'admin' : 'user'}">
                <div class="message-content">${msg.text || ''}</div>
                ${attachmentHtml}
                <div class="message-time">${messageTime}</div>
              </div>
            `;
          }).join('');
          
          // Scroll to bottom
          chatMessages.scrollTop = chatMessages.scrollHeight;
          
          // Mark messages as read by admin
          if (currentChat && currentChat.userId === userId) {
            markMessagesAsRead(userId, chat);
          }
        }
      } else {
        chatMessages.innerHTML = `
          <div class="error-message">
            <p>Error loading chat. User data not found.</p>
          </div>
        `;
      }
    }, (error) => {
      console.error("Error loading chat messages:", error);
      chatMessages.innerHTML = `
        <div class="error-message">
          <p>Error loading messages. Please try again.</p>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error setting up chat messages listener:", error);
  }
}

async function markMessagesAsRead(userId, chat) {
  try {
    // Find messages from user that are not read by admin
    const unreadMessages = chat.filter(msg => msg.sender === 'user' && !msg.readByAdmin);
    
    if (unreadMessages.length === 0) return;
    
    // Update messages to mark as read
    const updatedChat = chat.map(msg => {
      if (msg.sender === 'user' && !msg.readByAdmin) {
        return { ...msg, readByAdmin: true };
      }
      return msg;
    });
    
    // Update Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { chat: updatedChat });
    
    // Reset unread count in metadata
    const chatMetadataRef = doc(db, "chatMetadata", userId);
    await updateDoc(chatMetadataRef, { unreadCount: 0 });
    
    // Remove from admin notifications
    const adminNotificationRef = doc(db, "adminNotifications", "messages");
    const notificationDoc = await getDoc(adminNotificationRef);
    
    if (notificationDoc.exists()) {
      const newMessages = notificationDoc.data().newMessages || [];
      const updatedMessages = newMessages.filter(msg => msg.userId !== userId);
      
      await updateDoc(adminNotificationRef, { newMessages: updatedMessages });
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

async function resetUnreadCount(userId) {
  try {
    const chatMetadataRef = doc(db, "chatMetadata", userId);
    await updateDoc(chatMetadataRef, { unreadCount: 0 });
    
    // Update UI
    const conversationItem = document.querySelector(`.conversation-item[data-user-id="${userId}"]`);
    if (conversationItem) {
      conversationItem.classList.remove('unread');
      const unreadBadge = conversationItem.querySelector('.unread-badge');
      if (unreadBadge) {
        unreadBadge.remove();
      }
    }
    
    // Update total unread count
    updateUnreadCount();
  } catch (error) {
    console.error("Error resetting unread count:", error);
  }
}

async function handleSendMessage(e) {
  e.preventDefault();
  
  if (!currentChat) {
    alert('Please select a conversation first');
    return;
  }
  
  const messageInput = document.getElementById('adminMessageInput');
  const sendButton = document.getElementById('adminSendButton');
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
      sender: 'admin',
      timestamp: Timestamp.now(),
      readByUser: false
    };
    
    if (attachments.length > 0) {
      messageObj.attachment = attachments[0];
    }
    
    // Get user reference
    const userRef = doc(db, "users", currentChat.userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const chat = userData.chat || [];
      
      // Add message to chat array
      chat.push(messageObj);
      
      // Update user document
      await updateDoc(userRef, { chat });
      
      // Update chat metadata
      const chatMetadataRef = doc(db, "chatMetadata", currentChat.userId);
      await updateDoc(chatMetadataRef, {
        lastActive: Timestamp.now(),
        lastMessage: {
          text: originalMessage || 'Attachment',
          timestamp: Timestamp.now(),
          sender: 'admin'
        },
        userUnreadCount: (userData.userUnreadCount || 0) + 1
      });
      
      clearAttachments();
      
      // Stop typing indicator
      updateAdminTypingStatus(currentChat.userId, false);
    }
  } catch (error) {
    console.error("Error sending message:", error);
    alert('Failed to send message. Please try again.');
    // If there's an error, restore the message
    messageInput.value = originalMessage;
  } finally {
    // Re-enable send button
    sendButton.disabled = false;
  }
}

// Add Enter key handling for admin chat
document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('adminMessageInput');
  const sendButton = document.getElementById('adminSendButton');
  const chatForm = document.getElementById('adminChatForm');

  if (messageInput && chatForm) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
          chatForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  }
});

function setupFileUpload() {
  const fileInput = document.getElementById('adminFileAttachment');
  const attachmentPreview = document.getElementById('attachmentPreview');
  
  if (!fileInput || !attachmentPreview) return;
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds 10MB limit');
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
  document.getElementById('adminFileAttachment').value = '';
};

function setupImagePreviewModal() {
  const modal = document.getElementById('imagePreviewModal');
  if (!modal) return;
  
  const closeBtn = modal.querySelector('.close-preview');
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
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

async function updateAdminTypingStatus(userId, isTyping) {
  try {
    // Clear any existing timeout
    if (typingTimeouts[userId]) {
      clearTimeout(typingTimeouts[userId]);
    }
    
    // Update typing status in Firestore
    const adminTypingRef = doc(db, "adminTyping", userId);
    await setDoc(adminTypingRef, {
      isTyping,
      timestamp: Timestamp.now()
    });
    
    // Set timeout to clear typing status after 3 seconds
    if (isTyping) {
      typingTimeouts[userId] = setTimeout(async () => {
        await setDoc(adminTypingRef, {
          isTyping: false,
          timestamp: Timestamp.now()
        });
        delete typingTimeouts[userId];
      }, 3000);
    }
  } catch (error) {
    console.error("Error updating admin typing status:", error);
  }
}

async function updateAdminStatus(isOnline) {
  try {
    const adminStatusRef = doc(db, "adminStatus", "status");
    await setDoc(adminStatusRef, {
      online: isOnline,
      lastUpdated: Timestamp.now()
    });
  } catch (error) {
    console.error("Error updating admin status:", error);
  }
}

async function handleLogout() {
  try {
    // Set admin status to offline
    await updateAdminStatus(false);
    
    // Sign out from Firebase
    await signOut(auth);
    
    // Clear session storage
    sessionStorage.removeItem('adminLoggedIn');
    
    // Redirect to login page
    window.location.href = 'admin-login.html';
  } catch (error) {
    console.error("Error signing out:", error);
  }
}

async function exportChat() {
  if (!currentChat) return;

  try {
    const userRef = doc(db, "users", currentChat.userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error('Chat data not found');

    const chatData = userDoc.data().chat || [];
    const sortedMessages = [...chatData].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    const formattedMessages = sortedMessages.map(msg => {
      const sender = msg.sender === 'admin' ? 'Admin' : currentChat.userName;
      const timestamp = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleString() : 'Unknown time';
      let messageText = msg.text || '';
      const attachmentInfo = msg.attachment ? `\nAttachment: ${msg.attachment.name}` : '';
      return `[${timestamp}] ${sender}: ${messageText}${attachmentInfo}`;
    }).join('\n\n');

    const exportContent = `Chat with ${currentChat.userName} (${currentChat.userEmail})\nExported on: ${new Date().toLocaleString()}\n\n${formattedMessages}`;
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${currentChat.userId}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting chat:', error);
    alert('Failed to export chat');
  }
}

async function archiveChat() {
  if (!currentChat) return;

  if (!confirm(`Are you sure you want to archive the conversation with ${currentChat.userName}?`)) return;

  try {
    const chatMetadataRef = doc(db, "chatMetadata", currentChat.userId);
    await updateDoc(chatMetadataRef, { archived: true, archivedAt: Timestamp.now() });

    const archiveChatBtn = document.getElementById('archiveChatBtn');
    if (archiveChatBtn) {
      archiveChatBtn.innerHTML = '<i class="fas fa-box-open"></i> Unarchive';
      archiveChatBtn.onclick = () => unarchiveChat(currentChat.userId);
    }

    currentChat.archived = true;
    currentChat.archivedAt = Timestamp.now();
    renderConversations();
  } catch (error) {
    console.error('Error archiving chat:', error);
    alert('Failed to archive chat');
  }
}

window.unarchiveChat = async function(userId) {
  try {
    const chatMetadataRef = doc(db, "chatMetadata", userId);
    await updateDoc(chatMetadataRef, { archived: false, archivedAt: null });

    if (currentChat && currentChat.userId === userId) {
      const archiveChatBtn = document.getElementById('archiveChatBtn');
      if (archiveChatBtn) {
        archiveChatBtn.innerHTML = '<i class="fas fa-archive"></i> Archive';
        archiveChatBtn.onclick = archiveChat;
      }
      currentChat.archived = false;
      currentChat.archivedAt = null;
    }

    renderConversations();
  } catch (error) {
    console.error('Error unarchiving chat:', error);
    alert('Failed to unarchive chat');
  }
};

function updateUnreadCount() {
  // Calculate total unread messages
  const conversations = window.conversations || [];
  const totalUnread = conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
  
  // Update UI
  const unreadBadge = document.getElementById('adminUnreadCount');
  if (unreadBadge) {
    unreadBadge.textContent = totalUnread;
  }
}

// Set up event listeners for window unload
window.addEventListener('beforeunload', async () => {
  // Set admin status to offline when leaving the page
  await updateAdminStatus(false);
});

// Clean up on page unload
window.addEventListener('unload', () => {
  // Clean up subscriptions
  if (metadataSubscription) {
    metadataSubscription();
  }
  
  Object.values(chatSubscriptions).forEach(unsub => {
    if (typeof unsub === 'function') {
      unsub();
    }
  });
  
  // Clear typing timeouts
  Object.keys(typingTimeouts).forEach(userId => {
    if (typingTimeouts[userId]) {
      clearTimeout(typingTimeouts[userId]);
    }
  });
});