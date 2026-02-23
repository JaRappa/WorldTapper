import React from 'react';
import {
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

const TERMS_OF_SERVICE = `
WORLD TAPPER - TERMS OF SERVICE

Last Updated: February 23, 2026

Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the World Tapper application (the "Service") operated by World Tapper ("us", "we", or "our").

1. ACCEPTANCE OF TERMS

By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service.

2. AGE REQUIREMENT

You must be at least 14 years of age to use this Service. By using the Service, you represent and warrant that you are at least 14 years old. If you are under 18, you represent that you have your parent or guardian's permission to use the Service.

3. DESCRIPTION OF SERVICE

World Tapper is a casual clicker game where users tap to earn virtual clicks and can purchase virtual auto-clickers. The Service includes:
- A global click counter shared among all users
- Personal click balance and inventory
- Virtual store for purchasing auto-clickers
- Leaderboard functionality

4. USER ACCOUNTS

When you create an account with us, you must provide accurate, complete, and current information. You are responsible for:
- Safeguarding your password
- All activities that occur under your account
- Notifying us immediately of any unauthorized access

5. VIRTUAL ITEMS AND CURRENCY

All virtual items, clicks, and currency within the Service:
- Have no real-world monetary value
- Cannot be exchanged for real money or items of value
- Are licensed to you, not sold
- May be modified, removed, or reset at our discretion
- Are non-transferable between accounts

6. ACCEPTABLE USE

You agree NOT to:
- Use the Service for any unlawful purpose
- Attempt to gain unauthorized access to any systems
- Use automated scripts, bots, or hacks to manipulate the game
- Exploit bugs or glitches for unfair advantage
- Harass, abuse, or harm other users
- Impersonate any person or entity
- Interfere with or disrupt the Service
- Attempt to reverse engineer the Service

7. INTELLECTUAL PROPERTY

The Service and its original content, features, and functionality are owned by World Tapper and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.

8. USER CONTENT

By submitting content (such as usernames) to the Service, you grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, and display such content in connection with the Service.

9. TERMINATION

We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including:
- Breach of these Terms
- Conduct we deem harmful to other users or the Service
- At our sole discretion

Upon termination, your right to use the Service will immediately cease.

10. DISCLAIMER OF WARRANTIES

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
- IMPLIED WARRANTIES OF MERCHANTABILITY
- FITNESS FOR A PARTICULAR PURPOSE
- NON-INFRINGEMENT

We do not warrant that:
- The Service will be uninterrupted or error-free
- Defects will be corrected
- The Service is free of viruses or harmful components

11. LIMITATION OF LIABILITY

IN NO EVENT SHALL WORLD TAPPER, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION:
- LOSS OF PROFITS, DATA, USE, OR GOODWILL
- SERVICE INTERRUPTION
- COMPUTER DAMAGE OR SYSTEM FAILURE

OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST TWELVE (12) MONTHS, OR $10 USD, WHICHEVER IS GREATER.

12. INDEMNIFICATION

You agree to defend, indemnify, and hold harmless World Tapper and its affiliates from any claims, damages, obligations, losses, liabilities, costs, or expenses arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of any third-party rights

13. MODIFICATIONS TO SERVICE

We reserve the right to withdraw or amend our Service, and any service or material we provide, in our sole discretion without notice. We will not be liable if, for any reason, all or any part of the Service is unavailable at any time.

14. CHANGES TO TERMS

We reserve the right to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. Continued use of the Service after changes constitutes acceptance of the new Terms.

15. GOVERNING LAW

These Terms shall be governed by the laws of the United States, without regard to its conflict of law provisions.

16. DISPUTE RESOLUTION

Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. You waive any right to participate in class action lawsuits.

17. SEVERABILITY

If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.

18. ENTIRE AGREEMENT

These Terms constitute the entire agreement between you and World Tapper regarding the Service and supersede all prior agreements.

19. CONTACT US

If you have any questions about these Terms, please contact us at:
support@worldtapper.com

By using World Tapper, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
`;

const PRIVACY_POLICY = `
WORLD TAPPER - PRIVACY POLICY

Last Updated: February 23, 2026

This Privacy Policy describes how World Tapper ("we", "us", or "our") collects, uses, and shares information when you use our mobile application and website (collectively, the "Service").

1. INFORMATION WE COLLECT

1.1 Information You Provide:
- Account Information: Email address, username, and password when you create an account
- Profile Information: Any optional profile information you choose to provide

1.2 Information Collected Automatically:
- Device Information: Device type, operating system, unique device identifiers
- Usage Data: Game progress, click counts, purchases, playtime
- Log Data: IP address, browser type, access times, pages viewed

1.3 Information from Third Parties:
- Authentication providers (Amazon Cognito) for account verification

2. HOW WE USE YOUR INFORMATION

We use the information we collect to:
- Provide, maintain, and improve the Service
- Process your account registration
- Track game progress and maintain leaderboards
- Communicate with you about the Service
- Detect and prevent fraud, abuse, or security issues
- Comply with legal obligations
- Personalize your experience

3. INFORMATION SHARING

We may share your information in the following circumstances:

3.1 Public Information:
- Usernames and click counts are displayed on public leaderboards
- Do not use personal information as your username

3.2 Service Providers:
- Amazon Web Services (AWS) for hosting and authentication
- Analytics providers for usage statistics

3.3 Legal Requirements:
- When required by law or legal process
- To protect our rights, privacy, safety, or property
- To enforce our Terms of Service

3.4 Business Transfers:
- In connection with a merger, acquisition, or sale of assets

4. DATA RETENTION

We retain your information for as long as your account is active or as needed to provide the Service. We may retain certain information for legitimate business purposes or as required by law.

5. DATA SECURITY

We implement appropriate technical and organizational measures to protect your information, including:
- Encryption in transit and at rest
- Secure authentication via Amazon Cognito
- Regular security assessments

However, no method of transmission or storage is 100% secure. We cannot guarantee absolute security.

6. YOUR RIGHTS AND CHOICES

6.1 Account Information:
- You may update or delete your account information at any time
- Contact us to request data deletion

6.2 Communications:
- You may opt out of promotional communications

6.3 Data Access:
- You may request a copy of your personal data

7. CHILDREN'S PRIVACY

Our Service is not intended for children under 14 years of age. We do not knowingly collect personal information from children under 14. If we learn we have collected such information, we will delete it promptly.

If you are a parent or guardian and believe your child has provided us with personal information, please contact us.

8. INTERNATIONAL DATA TRANSFERS

Your information may be transferred to and processed in countries other than your own. These countries may have different data protection laws. By using the Service, you consent to such transfers.

9. THIRD-PARTY LINKS

The Service may contain links to third-party websites or services. We are not responsible for their privacy practices. We encourage you to read their privacy policies.

10. COOKIES AND TRACKING

We use cookies and similar technologies to:
- Maintain your session
- Remember your preferences
- Analyze usage patterns

You can control cookies through your browser settings.

11. DO NOT TRACK

We do not currently respond to "Do Not Track" signals as there is no industry standard for compliance.

12. CALIFORNIA PRIVACY RIGHTS (CCPA)

If you are a California resident, you have the right to:
- Know what personal information we collect
- Request deletion of your personal information
- Opt out of the sale of personal information (we do not sell personal information)
- Non-discrimination for exercising your rights

To exercise these rights, contact us at support@worldtapper.com.

13. EUROPEAN PRIVACY RIGHTS (GDPR)

If you are in the European Economic Area, you have the right to:
- Access your personal data
- Rectify inaccurate data
- Request erasure of your data
- Restrict or object to processing
- Data portability
- Withdraw consent
- Lodge a complaint with a supervisory authority

Legal basis for processing: consent, contract performance, legitimate interests.

14. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.

15. CONTACT US

If you have questions about this Privacy Policy, please contact us at:

Email: support@worldtapper.com

By using World Tapper, you acknowledge that you have read and understood this Privacy Policy.
`;

export function LegalModal({ visible, onClose, type }: LegalModalProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const content = type === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;
  const title = type === 'terms' ? '📜 Terms of Service' : '🔒 Privacy Policy';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.modalContent, { backgroundColor }]}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>{title}</ThemedText>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </Pressable>
            </View>
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
              <ThemedText style={styles.legalText}>{content.trim()}</ThemedText>
              <View style={styles.bottomPadding} />
            </ScrollView>
            
            <Pressable
              style={[styles.acceptButton, { backgroundColor: tintColor }]}
              onPress={onClose}
            >
              <ThemedText style={styles.acceptButtonText}>Close</ThemedText>
            </Pressable>
          </SafeAreaView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
  },
  safeArea: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    opacity: 0.6,
  },
  scrollView: {
    flex: 1,
  },
  legalText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  bottomPadding: {
    height: 20,
  },
  acceptButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  acceptButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
