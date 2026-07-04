import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { API_SOCKET_BASE, Claim, ClaimMessage, claimsApi } from '../../services/api';
import { formatDateTime } from '../../utils/format';

export default function ClaimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<ClaimMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    claimsApi.getById(id)
      .then((c) => {
        setClaim(c);
        setMessages(Array.isArray(c.messages) ? c.messages : []);
      })
      .catch((e) => {
        Alert.alert('Error', e.message || 'Error al cargar reclamo');
        router.back();
      })
      .finally(() => setLoading(false));

    const socket = io(API_SOCKET_BASE);
    socketRef.current = socket;
    socket.emit('join_claim', id);

    socket.on('new_message', ({ claimId, message }) => {
      if (claimId === id) {
        setMessages((prev) => [...prev, message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    socket.on('claim_status_updated', ({ claimId, status }) => {
      if (claimId === id) setClaim((prev) => prev ? { ...prev, status } : prev);
    });

    return () => {
      socket.emit('leave_claim', id);
      socket.disconnect();
    };
  }, [id, router]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      setSending(true);
      await claimsApi.addMessage(id, text.trim());
      setText('');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  if (loading || !claim) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Soporte: Orden #{claim.orderId.slice(0, 8)}</Text>
          <Text style={styles.headerSubtitle}>Estado: {claim.status === 'open' ? 'Pendiente' : claim.status === 'resolved' ? 'Resuelto' : 'Inválido'}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m, i) => `${i}`}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id;
          return (
            <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageOther]}>
              <Text style={styles.messageSender}>{item.senderRole === 'admin' ? 'Soporte' : 'Tú'}</Text>
              <Text style={[styles.messageText, isMe && { color: '#fff' }]}>{item.content}</Text>
              <Text style={[styles.messageTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>{formatDateTime(item.createdAt)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMuted }}>Escribe un mensaje para iniciar el chat.</Text>}
      />

      {claim.status === 'open' ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.closedContainer}>
          <Text style={styles.closedText}>Este caso ha sido cerrado.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary },
  messageList: { padding: 16, paddingBottom: 20 },
  messageBubble: {
    maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12,
  },
  messageOther: {
    alignSelf: 'flex-start', backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageMe: {
    alignSelf: 'flex-end', backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageSender: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  messageText: { fontSize: 15, color: Colors.textPrimary },
  messageTime: { fontSize: 10, color: Colors.textMuted, marginTop: 6, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 10,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: Colors.background,
    borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  closedContainer: { padding: 16, alignItems: 'center', backgroundColor: Colors.surface },
  closedText: { color: Colors.textMuted, fontWeight: '600' },
});
