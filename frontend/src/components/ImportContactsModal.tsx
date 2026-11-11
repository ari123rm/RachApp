// src/components/ImportContactsModal.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Check,
  LoaderCircle,
  BookUser,
  UserPlus,
  Phone,
  AlertCircle,
  Upload,
  BadgeCheck,
  RefreshCw,
} from 'lucide-react';
import { dbService } from '../services/database';
import { formatPhoneBR, stripCountryCode, phonesMatchBR } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor, PRESET_AVATAR_COLORS } from '../utils/avatarColor';
import {
  requestDeviceContacts,
  parseVCardContacts,
  getCachedPhoneContacts,
  type RawContactItem,
} from '../utils/phoneContacts';
import type { Amigo } from '../types';

export type RawPhoneContact = RawContactItem;

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFriends?: Amigo[];
  onImported?: (importedFriends: Amigo[]) => void;
}

export function ImportContactsModal({
  isOpen,
  onClose,
  existingFriends = [],
  onImported,
}: ImportContactsModalProps) {
  useModalBackHandler(isOpen, onClose);

  const [contacts, setContacts] = useState<RawPhoneContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [friendsList, setFriendsList] = useState<Amigo[]>(existingFriends);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const vcfInputRef = useRef<HTMLInputElement | null>(null);

  const handleLoadContacts = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await requestDeviceContacts();
      if (res.status === 'ok') {
        setContacts(res.contacts);
        if (res.contacts.length === 0) {
          setErrorMsg('Nenhum contato com número de telefone encontrado na agenda.');
        } else {
          dbService.amigos
            .discoverRegisteredUsers(
              res.contacts.map((c) => ({ name: c.name, phone: c.cleanPhone || c.phone }))
            )
            .then((users) => setRegisteredUsers(users))
            .catch(() => {});
        }
        return;
      }

      if (res.status === 'permission_denied') {
        setErrorMsg(
          'Permissão de acesso aos contatos negada. Toque em "Permitir" quando solicitado ou libere a permissão de Contatos nas configurações do aplicativo.'
        );
        return;
      }

      if (res.status === 'unsupported_apk') {
        setErrorMsg(
          'Para acessar a agenda diretamente com permissão do Android, instale a versão mais recente do APK ou importe um arquivo .VCF abaixo.'
        );
        return;
      }

      if (res.status === 'unsupported_browser') {
        setErrorMsg(
          'Seu navegador atual não suporta leitura direta da agenda. Use o aplicativo Android ou importe um arquivo .VCF da sua agenda.'
        );
        return;
      }

      if (res.status === 'error') {
        setErrorMsg('Não foi possível ler os contatos da agenda. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setSearch('');
    setErrorMsg('');
    setSelectedIds(new Set());

    dbService.amigos
      .getAll()
      .then((all) => setFriendsList(all))
      .catch(() => {});

    const cached = getCachedPhoneContacts();
    if (cached.length > 0) {
      setContacts(cached);
      dbService.amigos
        .discoverRegisteredUsers(
          cached.map((c) => ({ name: c.name, phone: c.cleanPhone || c.phone }))
        )
        .then((users) => setRegisteredUsers(users))
        .catch(() => {});
    }

    handleLoadContacts();
  }, [isOpen, handleLoadContacts]);

  const isAlreadyFriend = (contact: RawPhoneContact): boolean => {
    return friendsList.some((f) => {
      const fPhone = stripCountryCode(f.telefone || f.phone || '');
      if (contact.cleanPhone && fPhone && phonesMatchBR(contact.cleanPhone, fPhone)) {
        return true;
      }
      const fName = (f.nome || f.name || '').trim().toLowerCase();
      return !contact.cleanPhone && Boolean(fName) && fName === contact.name.trim().toLowerCase();
    });
  };

  const getRegisteredAccountForContact = (contact: RawPhoneContact) => {
    if (!contact.cleanPhone) return null;
    return registeredUsers.find(
      (u) => u.phone && phonesMatchBR(contact.cleanPhone, stripCountryCode(u.phone))
    );
  };

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return contacts.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch =
        c.phone.toLowerCase().includes(q) ||
        (qDigits.length >= 2 && c.cleanPhone.includes(qDigits));
      return nameMatch || phoneMatch;
    });
  }, [contacts, search]);

  if (!isOpen) return null;

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectableFiltered = filteredContacts.filter((c) => !isAlreadyFriend(c));
  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((c) => selectedIds.has(c.id));

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        selectableFiltered.forEach((c) => next.delete(c.id));
      } else {
        selectableFiltered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const handleVcfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    try {
      const text = await file.text();
      const normalized = parseVCardContacts(text);
      setContacts(normalized);
      if (normalized.length === 0) {
        setErrorMsg('Nenhum contato válido encontrado no arquivo .vcf.');
      } else {
        dbService.amigos
          .discoverRegisteredUsers(
            normalized.map((c) => ({ name: c.name, phone: c.cleanPhone || c.phone }))
          )
          .then((users) => setRegisteredUsers(users))
          .catch(() => {});
      }
    } catch {
      setErrorMsg('Não foi possível ler o arquivo de contatos (.vcf).');
    } finally {
      if (vcfInputRef.current) vcfInputRef.current.value = '';
    }
  };

  const handleImportSelected = async () => {
    const chosen = contacts.filter((c) => selectedIds.has(c.id));
    if (chosen.length === 0) {
      setErrorMsg('Selecione pelo menos um contato para importar.');
      return;
    }

    setIsImporting(true);
    setErrorMsg('');

    try {
      const created: Amigo[] = [];
      for (let i = 0; i < chosen.length; i++) {
        const c = chosen[i];
        const regAccount = getRegisteredAccountForContact(c);
        const color = PRESET_AVATAR_COLORS[i % PRESET_AVATAR_COLORS.length];
        const saved = await dbService.amigos.create({
          nome: c.name.slice(0, 30),
          telefone: c.cleanPhone,
          pix_key: regAccount?.pix_key || '',
          cor: color,
          favorito: false,
        });
        created.push(saved);
      }

      if (onImported) onImported(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao importar os contatos selecionados.');
    } finally {
      setIsImporting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--border-color)] shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-slide-up pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-5 pb-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <BookUser size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[var(--text-primary)] text-h2 leading-tight">
                Importar da Lista de Contatos
              </h2>
              <p className="text-caption text-[var(--text-secondary)]">
                Selecione os contatos do celular que deseja adicionar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Barra de Busca e Controles */}
        <div className="px-5 pt-4 space-y-3">
          <div className="bg-[var(--bg-subtle)] rounded-xl h-12 px-4 flex items-center gap-2.5 border border-[var(--border-color)] focus-within:border-[var(--primary)] transition-colors">
            <Search size={18} strokeWidth={2} className="text-[var(--text-secondary)] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato por nome ou telefone..."
              className="bg-transparent text-body2 text-[var(--text-primary)] outline-none w-full placeholder:text-[var(--text-secondary)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-caption">
            <span className="text-[var(--text-secondary)] font-medium">
              {filteredContacts.length}{' '}
              {filteredContacts.length === 1 ? 'contato encontrado' : 'contatos encontrados'}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLoadContacts}
                disabled={isLoading}
                className="text-[var(--primary)] font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw size={12} strokeWidth={2} className={isLoading ? 'animate-spin' : ''} />
                <span>Atualizar agenda</span>
              </button>

              {selectableFiltered.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[var(--primary)] font-semibold hover:underline"
                >
                  {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Contatos */}
        <div className="flex-1 overflow-y-auto p-5 pt-3 space-y-2 scrollbar-hide">
          {errorMsg && (
            <div className="bg-[var(--rose-bg)] border border-[var(--rose-border)] p-3 rounded-xl flex items-start gap-2 text-[#F43F5E] text-caption font-semibold mb-2">
              <AlertCircle size={16} strokeWidth={2} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-[var(--primary)]">
              <LoaderCircle size={32} strokeWidth={2} className="animate-spin mb-2" />
              <span className="text-caption text-[var(--text-secondary)]">
                Solicitando permissão e lendo contatos da sua agenda...
              </span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="bg-[var(--bg-subtle)] rounded-2xl p-6 text-center border border-[var(--border-color)] space-y-3">
              <BookUser size={32} strokeWidth={2} className="text-[var(--primary)] mx-auto opacity-80" />
              <div>
                <p className="text-body2 font-semibold text-[var(--text-primary)]">
                  Permitir acesso aos seus contatos
                </p>
                <p className="text-caption text-[var(--text-secondary)] mt-1">
                  Toque no botão abaixo para autorizar a permissão de contatos e listar a agenda do seu celular.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLoadContacts}
                  className="w-full sm:w-auto ds-btn-primary text-caption px-5"
                >
                  <BookUser size={16} strokeWidth={2} /> Permitir e Carregar Contatos
                </button>

                <input
                  ref={vcfInputRef}
                  type="file"
                  accept=".vcf,text/vcard"
                  onChange={handleVcfUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => vcfInputRef.current?.click()}
                  className="w-full sm:w-auto ds-btn-secondary text-caption px-4"
                >
                  <Upload size={15} strokeWidth={2} /> Importar arquivo .VCF
                </button>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="bg-[var(--bg-subtle)] rounded-2xl p-6 text-center border border-[var(--border-color)]">
              <p className="text-caption text-[var(--text-secondary)]">
                Nenhum contato encontrado para "{search}".
              </p>
            </div>
          ) : (
            filteredContacts.map((contact, idx) => {
              const alreadyAdded = isAlreadyFriend(contact);
              const regUser = getRegisteredAccountForContact(contact);
              const isSelected = selectedIds.has(contact.id);
              const color = PRESET_AVATAR_COLORS[idx % PRESET_AVATAR_COLORS.length];

              return (
                <div
                  key={contact.id}
                  onClick={() => {
                    if (!alreadyAdded) toggleContact(contact.id);
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    alreadyAdded
                      ? 'bg-[var(--bg-subtle)]/50 border-[var(--border-color)] opacity-60 cursor-default'
                      : isSelected
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)] cursor-pointer shadow-sm'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-color)] hover:border-[var(--primary)]/40 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={
                        regUser?.avatar_url
                          ? undefined
                          : { backgroundColor: getAvatarColor(color) }
                      }
                      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-body2 shrink-0"
                    >
                      {regUser?.avatar_url ? (
                        <img
                          src={regUser.avatar_url}
                          alt={contact.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        contact.name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-body2 font-semibold text-[var(--text-primary)] truncate">
                          {contact.name}
                        </h4>
                        {regUser && (
                          <span className="inline-flex items-center gap-1 text-caption font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full shrink-0">
                            <BadgeCheck size={12} strokeWidth={2} />
                            Tem conta
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-[var(--text-secondary)] flex items-center gap-1 truncate">
                        <Phone size={12} strokeWidth={2} className="shrink-0" />
                        <span>
                          {contact.cleanPhone
                            ? formatPhoneBR(contact.cleanPhone)
                            : contact.phone || 'Sem número'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {alreadyAdded ? (
                      <span className="text-caption bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)] px-2.5 py-1 rounded-full font-semibold">
                        Já adicionado
                      </span>
                    ) : (
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
                        }`}
                      >
                        {isSelected && <Check size={14} strokeWidth={2.5} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="flex-1 ds-btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImportSelected}
            disabled={isImporting || selectedIds.size === 0}
            className="flex-1 ds-btn-primary"
          >
            {isImporting ? (
              <>
                <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />
                <span>Importando...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} strokeWidth={2} />
                <span>
                  {selectedIds.size > 0
                    ? `Importar ${selectedIds.size} ${
                        selectedIds.size === 1 ? 'Contato' : 'Contatos'
                      }`
                    : 'Importar Selecionados'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
