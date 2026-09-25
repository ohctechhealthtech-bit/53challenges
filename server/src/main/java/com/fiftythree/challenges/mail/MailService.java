package com.fiftythree.challenges.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends plain-text email, replacing Base44's
 * {@code integrations.Core.SendEmail}.
 *
 * <p><b>Sending is best-effort by design.</b> Every caller here is notifying
 * somebody about something that has already happened in the database — a
 * guardian approval waiting, a decision made. The record is the source of
 * truth and the dashboard is the reliable channel; a bounced or refused email
 * must never roll back the thing it was describing. So {@link #send} reports
 * success or failure and throws neither.
 *
 * <p>With no mail host configured it reports every send as unsent and logs
 * once at startup, rather than failing at the first attempt.
 */
@Service
public class MailService {

  private static final Logger log = LoggerFactory.getLogger(MailService.class);

  private final ObjectProvider<JavaMailSender> sender;
  private final String from;
  private final String fromName;

  public MailService(
      ObjectProvider<JavaMailSender> sender,
      @Value("${app.mail.from:}") String from,
      @Value("${app.mail.from-name:53 Challenges}") String fromName) {
    this.sender = sender;
    this.from = from == null ? "" : from.trim();
    this.fromName = fromName;

    if (this.from.isEmpty()) {
      log.warn("No MAIL_FROM configured — outbound email is disabled. "
          + "Guardian and host notifications will be recorded as unsent.");
    }
  }

  public boolean isConfigured() {
    return !from.isEmpty() && sender.getIfAvailable() != null;
  }

  /**
   * Sends one message.
   *
   * @return true when it was handed to the mail server, false otherwise. False
   *     is an ordinary outcome, not an error — the caller records it and
   *     carries on.
   */
  public boolean send(String to, String subject, String body) {
    if (to == null || to.isBlank()) {
      return false;
    }
    JavaMailSender mailSender = sender.getIfAvailable();
    if (mailSender == null || from.isEmpty()) {
      log.debug("Email to {} not sent: no mail sender configured", to);
      return false;
    }

    try {
      SimpleMailMessage message = new SimpleMailMessage();
      // The display name goes in the From header alongside the address. SES
      // rejects a From whose address is not a verified identity, whatever the
      // display name says.
      message.setFrom(fromName == null || fromName.isBlank()
          ? from : fromName + " <" + from + ">");
      message.setTo(to);
      message.setSubject(subject);
      message.setText(body);
      mailSender.send(message);
      return true;
    } catch (Exception e) {
      // Logged at warn, not error: a refused recipient is an expected outcome
      // here, and an error-level entry for each one would bury real faults.
      log.warn("Email to {} could not be sent: {}", to, e.toString());
      return false;
    }
  }
}
